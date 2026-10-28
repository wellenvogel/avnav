---
  tags:
    - Extensions
    - Plugins
    - CSS
    - JavaScript
---

# Extensions and plugins

AvNav offers various ways to extend and modify its functionality and appearance.
In addition to the options for [configuring](../base/settings.md) display properties directly in the interface, customizing the displays (widgets) via [layouts](../base/layout.md), [connections](configfile.md#channelspage), and other [server parameters](configfile.md), the following options are available:

1. Customizing the appearance via [CSS](https://en.wikipedia.org/wiki/Cascading_Style_Sheets)<!--@@linkchanged-->. AvNav is a web application and uses CSS for its appearance. Various options are built in to adapt the rules used for this:
    1. Custom CSS for all displays in a [user.css](usercss.md) file
    2. CSS for a specific layout - directly in the [layout](layout.md#layoutcss)
    3. CSS in [plugins](plugins.md)

2. Extending the display functionality via [JavaScript](https://en.wikipedia.org/wiki/JavaScript)<!--@@linkchanged--> code. This can be used, for example, to add a new formatter to convert a value for display in a widget. 
In addition, functionality can be extended in other areas (with varying levels of difficulty):
   * Creating your own data displays (or extending existing ones) for the navigation page and the dashboards (text-based and graphical)
   * Creating displays directly on the map (map widgets)
   * Integrating additional map types: Here, for example, different types of vector maps can be integrated
   * Format functions for displaying map or overlay information
   * Custom dialogs
   * Access to online resources
   * ...

   This code can be introduced in two ways:

    1. A [*user.mjs*](userjs.md) file in the user directory
    2. JavaScript code in [plugins](plugins.md#jscode)

3. Server extensions in [Python](https://en.wikipedia.org/wiki/Python_(programming_language))<!--@@linkchanged-->.
   This function is only available for the Linux and Windows versions. The Python code must be part of a [plugin](plugins.md#pluginpython).

All these possibilities require a certain amount of know-how or familiarization with the respective languages used. However, simple adjustments can often be achieved through discussion in the [community](../concept/introduction.md#a_community) or with AI assistance. Only a good text editor is required to create or edit the extensions; no special tools are necessary. For many functions, the editor integrated into AvNav is sufficient.
!!! Note
    When creating extensions, you will usually create or edit text in various files. AvNav has no built-in functions to back up this data (or a history of it). Therefore, this data should be kept in another location, e.g., using the available download functions. This protects against loss in the event that the entire AvNav system should fail.

## Documentation

There is detailed documentation available on this topic:

### CSS
* [user.css](usercss.md): Customizing the appearance with user-specific CSS code
* [CSS in layouts](layout.md): CSS code directly in layouts
* [CSS in plugins](plugins.md#plugincss): CSS in plugins

### JavaScript
* [user.mjs](userjs.md): User-specific JavaScript code for all displays
* [JavaScript in plugins](plugins.md#jscode): JavaScript code in plugins

### Plugins
* [Overview](plugins.md#overview)
* [Ready-made plugins](plugin-list.md): List of already available plugins
* [CSS](plugins.md#plugincss): CSS in plugins
* [JavaScript](plugins.md#jscode): JavaScript code in plugins
* [Server](plugins.md#pluginpython): Server functions for plugins (with Python)