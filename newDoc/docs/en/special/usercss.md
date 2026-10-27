---
  tags:
    - CSS
---
Customizing with CSS
====================

Since AvNav is a web application, you can largely customize its appearance using CSS.

The file intended for this purpose, *user.css*, is located in the user files directory: *BASEDIR/user/viewer*. On [Raspberry Pi images](../installation/raspberry.md#images), "BASEDIR" stands for */home/pi/avnav/data*, otherwise it refers to *$HOME/avnav*.

You can list, edit, create new files, or upload files in the user directory via:

{{MM("MMaddonconfigpage")}}->{{BT("AddonConfigUser")}}

The *user.css* file can also be found there.

![user.css file](../../img/usercss-file.png)
///caption
User files - user.css
///

By clicking on the file and selecting "Edit", you can modify it. During installation, a template is provided that contains an example.

## Editor

![user.css Editor](../../img/usercss-editor.png)
///caption
user.css - Editor
///

The editor features syntax highlighting, which can help you generate correct CSS syntax.
As soon as you click the {{DB("DBSave")}} button, the file is saved and the changes become visible on all connected screens. This makes it quite easy to work with two browser windows or tabs—in one window you have the editor open, and in the other, you have the view you want to change.

## Variables {: #variables }

For a wide range of display properties, AvNav provides [custom properties](https://developer.mozilla.org/en/docs/Web/CSS/Guides/Cascading_variables/Using_custom_properties) <!--@@linkchanged-->.

The values set by AvNav can be found in [properties.less](https://github.com/wellenvogel/avnav/blob/master/viewer/style/properties.less).

In the example image, the color for the page titles (*--avnav-main-color*) was set to a slightly lighter value.

## Color Editor

To easily edit colors, you can highlight a color value in the CSS and then invoke the color editor via {{DB("DBColor")}}. Upon closing, the new color value is inserted.

## Finding Properties

The fastest way to adjust properties is by using the browser's developer tools (often accessible via F11 or a similar combination—or through the menu).
You should use a desktop/laptop browser for this—it is usually not possible with browsers on mobile devices.

![usercss developer tools](../../img/usercss-devtools.png)
///caption
Developer tools
///

Circled in the example is the button for the anchor watch on the dashboard pages. The element clicked in the developer tools is usually highlighted in the webpage.

## Buttons and Icons {: #buttons-icons }
To customize buttons or icons, you must identify the name of the button/icon.
With the display in the image, we found that the button is named [AnchorWatch](../../buttons/buttons.md#AnchorWatch) - we can compare this again with the button list.
If we now want to replace the image with another, we must first upload the image as an **.svg** file. This is done in the {{BT("AddonConfigImages")}} section of the page where we also edit the *user.css*.

We can now insert the following CSS code, assuming the image is named "alt-anchor.svg":
```
.button.AnchorWatch .icon{
    background-image: url(/user/images/alt-anchor.svg);    
}
```

If we want a different icon for the *legacy* icon set, we can additionally insert:

```
.icon-legacy .button.AnchorWatch .icon{
    background-image: url(/user/images/alt-anchor-legacy.svg);    
}
```
For changed text, we can use the following CSS:
```
.button.AnchorWatch:after{
    content: 'ANCHR'
}
```
If one of the long texts needs to be changed, this requires:
```
.button.AnchorWatch.longText:after{
    content: 'ANCHR'
}
```

## Specificity

If there are multiple CSS rules for the same element, which is usually the case, the [specificity](https://developer.mozilla.org/en/docs/Web/CSS/Guides/Cascade/Specificity) <!--@@linkchanged--> is taken into account. If there are multiple rules with the same specificity, the last rule read wins. AvNav ensures that the rules from *user.css* are always read last—and thus override other rules with the same specificity.
However, if the specificity is lower, it will not work. In the example above, `AnchorWatch .icon{` would not work because `button.AnchorWatch .icon{` is already used in AvNav.

## Other CSS Sources

The functions described here also apply to other sources of CSS—such as layouts and plugins.