---
  tags:
    - Extensions
    - User Apps
---
Some of the content in this section is also presented in the **{{VIDEO("Video here","userapps")}}**.

## User Apps vs. Plugins

AvNav can be versatilely adapted and expanded - these extensions include so-called User Apps. These are standalone applications whose user interface can be accessed via a web browser. Examples of this include the data server SignalK or the AIS-Catcher. To avoid constant switching between different browser tabs, these applications can be seamlessly integrated as buttons directly into the AvNav user interface.

For classification: besides User Apps, AvNav also has plugins. These are programs that work independently and directly with internal AvNav data, such as the History, O-Charts, or Update plugins. Many of these plugins also come with their own web interface for operation. When that is the case, they behave like User Apps from the perspective of the user interface and can be set up as such. More about plugins and how they can be programmed can be read in a separate, in-depth [chapter](../special/plugins-extensions.md).

The following describes how such a User App can be defined and integrated into the AvNav interface, using SignalK as an example.

## Preparing and uploading the icon

To ensure the new app is recognizable in the AvNav interface, you must assign it a unique, meaningful icon. For this, a suitable image, ideally in SVG or PNG format at 50x50 px, is required. Use {{MB("MMaddonconfigpage")}} to enter the "CSS, JS, User Apps" page.

![Load Image](../../img/userapp-addimage.png)

 If not all columns are displayed on a smaller screen, you can reach the "Image Files" column by swiping or by using the {{BT('AddonConfigImages')}} button in the button bar.

 After clicking the upload file button {{BT("Upload")}}, you can upload the desired icon so that it is available to the system during configuration.

## Defining a User App

The actual definition of the User App takes place via the "Create User App" dialog. This opens via the {{BT("AddonConfigPlus")}} icon.

![Create User App](../../img/userapp-defSK.png)

You can get a concise help text for the field contents via {{BT("Help")}}. The button {# {{ICON("SettingsDefaults")}} not working? #} {{BT("SettingsDefaults")}} resets the field content to the default value. Here is more detailed information:

| Field | Meaning |
| ------ | -------- |
| internal | If the checkbox is **checked**, AvNav acts as a simple web server and displays an HTML page stored on the device. In the section [Details](../special/userfiles.md#userappexample), you will find a description of how to display your own PDF boat documents as a more advanced application.<br><br>If the checkbox is **not checked**, web addresses are called. |
| internal url| Only displayed if the "internal" field is **checked**:<br>Upon entering the field, a list of already uploaded HTML files is displayed. You must select one of them or upload a new one. |
| external url| Only displayed if the "internal" checkbox is **not checked**:<br>Any web address for devices on the network or the internet. This must begin with http:// or https://. If the service is located on the AvNav server, $HOST should be used instead of the IP address. This is the only way to ensure that browsers can reach the destination even when accessing via a different network connection. |
| icon | The icon for the app is selected here. The number of list entries can be significantly reduced by unselecting the "builtin" option. If the desired image is not yet in the list, a new file can be uploaded via {{DB("Upload")}} at the end of the list. |
| title | This text is displayed in the title bar of the User App. |
| new window | Only displayed if the "internal" checkbox is **not checked**:<br>If this checkbox is checked, the User App will be opened in a new browser window or tab. |
| page| By default, User Apps are displayed on the "User Apps" page in the button bar. However, it is also possible to place the button on other pages where it might be easier to find depending on the context. The most common pages, based on the menu entries, are:<br><br>navpage - Navigation page<br>gpspage - Dashboard pages<br>aispage - AIS page<br>addonpage - User App page<br>serverpage - Server page |
| short text| This is the text that the button in the button bar displays. Naturally, only a few characters fit here. |
| long text | This is the text displayed by the entry in the respective main menu section. |
| button | This field cannot be changed. It is filled automatically by the system and contains an identifier that enables advanced adjustments via CSS. |