const handlebars = require("handlebars")
const actions = require("./actions")
const logic = require("./logic")
const automationUtils = require("./automationUtils")
const cloneDeep = require("lodash/cloneDeep")

handlebars.registerHelper("object", value => {
  return new handlebars.SafeString(JSON.stringify(value))
})

const FILTER_STEP_ID = logic.BUILTIN_DEFINITIONS.FILTER.stepId

function recurseMustache(inputs, context) {
  for (let key of Object.keys(inputs)) {
    let val = inputs[key]
    if (typeof val === "string") {
      val = automationUtils.cleanMustache(inputs[key])
      const template = handlebars.compile(val)
      inputs[key] = template(context)
    }
    // this covers objects and arrays
    else if (typeof val === "object") {
      inputs[key] = recurseMustache(inputs[key], context)
    }
  }
  return inputs
}

/**
 * The automation orchestrator is a class responsible for executing automations.
 * It handles the context of the automation and makes sure each step gets the correct
 * inputs and handles any outputs.
 */
class Orchestrator {
  constructor(automation, triggerOutput) {
    this._instanceId = triggerOutput.instanceId
    // remove from context
    delete triggerOutput.instanceId
    // step zero is never used as the mustache is zero indexed for customer facing
    this._context = { steps: [{}], trigger: triggerOutput }
    this._automation = automation
  }

  spawnFromGenerator(generatorOutputs) {
    const newOrchestrator = new Orchestrator(
      cloneDeep(this._automation),
      cloneDeep(this._context.trigger)
    )
    newOrchestrator._instanceId = this._instanceId
    newOrchestrator._context = cloneDeep(this._context)
    newOrchestrator._context.steps.push(generatorOutputs)
    return newOrchestrator
  }

  async getStepFunctionality(type, stepId) {
    let step = null
    if (type === "ACTION") {
      step = await actions.getAction(stepId)
    } else if (type === "LOGIC") {
      step = logic.getLogic(stepId)
    }
    if (step == null) {
      throw `Cannot find automation step by name ${stepId}`
    }
    return step
  }

  async execute() {
    let automation = this._automation
    // steps contains the trigger (so theres always at least one)
    const startingPosition = this._context.steps.length - 1

    for (
      let stepNumber = startingPosition;
      stepNumber < automation.definition.steps.length;
      stepNumber++
    ) {
      const step = automation.definition.steps[stepNumber]
      let stepFn = await this.getStepFunctionality(step.type, step.stepId)
      step.inputs = recurseMustache(step.inputs, this._context)
      step.inputs = automationUtils.cleanInputValues(
        step.inputs,
        step.schema.inputs
      )
      // instanceId is always passed
      try {
        const outputs = await stepFn({
          inputs: step.inputs,
          instanceId: this._instanceId,
          apiKey: automation.apiKey,
        })

        if (step.stepId === FILTER_STEP_ID && !outputs.success) {
          break
        }

        if (isGenerator(outputs)) {
          for await (const spawnedOutputs of outputs) {
            const spawnedOrchectrator = this.spawnFromGenerator(spawnedOutputs)
            await spawnedOrchectrator.execute()
          }
          // automation is continued by children only
          break
        }

        this._context.steps.push(outputs)
      } catch (err) {
        console.error(`Automation error - ${step.stepId} - ${err}`)
      }
    }
  }
}

function isGenerator(obj) {
  return (
    obj && typeof obj.next === "function" && typeof obj.throw === "function"
  )
}

// callback is required for worker-farm to state that the worker thread has completed
module.exports = async (job, cb = null) => {
  try {
    const automationOrchestrator = new Orchestrator(
      job.data.automation,
      job.data.event
    )
    await automationOrchestrator.execute()
    if (cb) {
      cb()
    }
  } catch (err) {
    if (cb) {
      cb(err)
    }
  }
}
