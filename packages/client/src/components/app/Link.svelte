<script>
  import { getContext } from "svelte"
  import Placeholder from "./Placeholder.svelte"

  const { linkable, styleable, builderStore } = getContext("sdk")
  const component = getContext("component")

  export let url
  export let text
  export let openInNewTab
  export let color
  export let align
  export let bold
  export let italic
  export let underline
  export let size

  let node

  $: $component.editing && node?.focus()
  $: externalLink = url && typeof url === "string" && !url.startsWith("/")
  $: target = openInNewTab ? "_blank" : "_self"
  $: placeholder = $builderStore.inBuilder && !text
  $: componentText = getComponentText(text, $builderStore, $component)
  $: sanitizedUrl = getSanitizedUrl(url, externalLink, openInNewTab)

  // Add color styles to main styles object, otherwise the styleable helper
  // overrides the color when it's passed as inline style.
  $: styles = enrichStyles($component.styles, color)

  const getSanitizedUrl = (url, externalLink, newTab) => {
    if (!url) {
      return externalLink || newTab ? "#/" : "/"
    }
    if (externalLink) {
      return url
    }
    if (openInNewTab) {
      return `#${url}`
    }
    return url
  }

  const getComponentText = (text, builderState, componentState) => {
    if (!builderState.inBuilder || componentState.editing) {
      return text || ""
    }
    return text || componentState.name || "Placeholder text"
  }

  const enrichStyles = (styles, color) => {
    if (!color) {
      return styles
    }
    return {
      ...styles,
      normal: {
        ...styles?.normal,
        color,
      },
    }
  }

  const updateText = e => {
    builderStore.actions.updateProp("text", e.target.textContent)
  }
</script>

{#if $component.editing}
  <div
    bind:this={node}
    contenteditable
    use:styleable={styles}
    class:bold
    class:italic
    class:underline
    class="align--{align || 'left'} size--{size || 'M'}"
    on:blur={$component.editing ? updateText : null}
  >
    {componentText}
  </div>
{:else if $builderStore.inBuilder || componentText}
  {#if !url && !text}
    <div use:styleable={{ ...$component.styles, empty: true }}>
      <Placeholder />
    </div>
  {:else if externalLink || openInNewTab}
    <a
      {target}
      href={sanitizedUrl}
      use:styleable={styles}
      class:placeholder
      class:bold
      class:italic
      class:underline
      class="align--{align || 'left'} size--{size || 'M'}"
    >
      {componentText}
    </a>
  {:else}
    {#key sanitizedUrl}
      <a
        use:linkable
        href={sanitizedUrl}
        use:styleable={styles}
        class:placeholder
        class:bold
        class:italic
        class:underline
        class="align--{align || 'left'} size--{size || 'M'}"
      >
        {componentText}
      </a>
    {/key}
  {/if}
{/if}

<style>
  a,
  div {
    color: var(--spectrum-alias-text-color);
    transition: color 130ms ease-in-out;
  }
  a:not(.placeholder):hover {
    color: var(--spectrum-link-primary-m-text-color-hover) !important;
  }
  .placeholder {
    font-style: italic;
    color: var(--spectrum-global-color-gray-600);
  }
  .bold {
    font-weight: 600;
  }
  .italic {
    font-style: italic;
  }
  .underline {
    text-decoration: underline;
  }
  .size--S {
    font-size: 14px;
  }
  .size--M {
    font-size: 16px;
  }
  .size--L {
    font-size: 18px;
  }
  .align--left {
    text-align: left;
  }
  .align--center {
    text-align: center;
  }
  .align--right {
    text-align: right;
  }
  .align-justify {
    text-align: justify;
  }
</style>
