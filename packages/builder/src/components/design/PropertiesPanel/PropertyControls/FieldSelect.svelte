<script>
  import { Select } from "@budibase/bbui"
  import {
    getDatasourceForProvider,
    getSchemaForDatasource,
  } from "builderStore/dataBinding"
  import { currentAsset } from "builderStore"
  import { createEventDispatcher } from "svelte"

  export let componentInstance = {}
  export let value = ""
  export let placeholder
  export let autofocus = false

  const dispatch = createEventDispatcher()
  $: datasource = getDatasourceForProvider($currentAsset, componentInstance)
  $: schema = getSchemaForDatasource($currentAsset, datasource).schema
  $: options = Object.keys(schema || {})
  $: boundValue = getValidValue(value, options)

  const getValidValue = (value, options) => {
    // Reset value if there aren't any options
    if (!Array.isArray(options)) {
      return null
    }

    // Reset value if the value isn't found in the options
    if (options.indexOf(value) === -1) {
      return null
    }

    return value
  }

  const onChange = value => {
    boundValue = getValidValue(value.detail, options)
    dispatch("change", boundValue)
  }
</script>

<Select
  {placeholder}
  value={boundValue}
  on:change={onChange}
  {options}
  {autofocus}
/>
