---
  tags:
   - User files
   - Extensions
   - User Apps
---

# User files

AvNav can store files for the user that can be created, uploaded, edited, viewed, and downloaded directly via the web interface.
These files are stored in the AvNav data directory under *.../user/viewer*. The data directory is usually found in the user's home directory under *avnav*. On the [Raspberry Pi Images](../installation//raspberry.md#images) it is located at */home/pi/avnav/data* and on Android it is defined in the Android settings.

## Display and Actions

You can reach the user files view under

{{MM("MMaddonconfigpage")}}->{{BT("AddonConfigUser")}}

![User files](../../img/userfiles.png)
///caption
User files
///

Initially, only a few template files are present there:
{ #specialfiles }

* [user.css](usercss.md): Customization via CSS
* [user.mjs](userjs.md): User JavaScript
* [keys.json](keyboard.md): Keyboard shortcuts
* [splitkeys.json](splitmode.md): Customizations for split mode

Clicking on a file opens a dialog with some additional information and various possible actions.

![Actions](../../img/userfiles-filedialog.png)
///caption
Actions
///

### Actions { #fileactions }

The possible actions depend on the file type. For known types like in the example, there are:

| Button | Function |
| --- | --- |
| {{DB("DBDelete")}} | Delete the file |
| {{DB("DBRename")}} | Assign a new name for the file. *Note*: If you rename *user.css*, for example, it will no longer be effective, and the AvNav server will create a new template file for it upon the next start. |
| {{DB("DBCopy")}} | Copy the file on the server. |
| {{DB("DBView")}} | View the file. For most supported files, this is a simple text view. |
| {{DB("Edit")}} | Edit the file in a built-in editor. Normally, this is a text editor with syntax highlighting for known files. |
| {{DB("DBDownload")}} | Download the file from the server and save it to the device currently used for viewing. | 

## Creating and Uploading

If you want to create a new file, use the {{SB('CreateFile')}} button above the file list. After selecting the name, an editor dialog will open for editable files; for some file types, a template text is inserted. Use {{DB("DBSave")}} or {{DB("DBOk")}} to save the file (only active if the file has been modified).

To upload from the device running the browser, use the {{SB("Upload")}} button above the file list. If a file with the same name already exists, you can assign a new name for the file.

## Images { #images }

Image files can also be stored as user files. To keep things a bit more organized, these can also be stored under {{BT("AddonConfigImages")}}. The functions are the same.

## Use of the files

Besides the [special files](#specialfiles) described above, any files can be placed in the user directory.

HTML files can be particularly useful. Since all files from this directory are accessible from a web browser via the URL
```
  http://nn.nn.nn.nn:8080/user/viewer/xxx
```
you can very easily create additional pages that can be displayed inside and outside of AvNav. For this purpose, the option to set up the files as so-called "[User App](../base/userapps.md)" or AddOn is available on the same page under {{BT("AddonConfigAddOns")}}.

## Example for an HTML file { #userappexample }

With an HTML file and other uploaded files, you can, for example, build a very simple document list that you can then use in AvNav with a click.
Assume you have two documents `Boot.pdf` and `Motor.pdf`. These are uploaded as user files as described via {{SB("Upload")}}.
Using {{SB('CreateFile')}}, you create an HTML file `dokumente.html` with the following content:
```
<html>
<head>
 <style>
   li{
    line-height: 1.5em;
   }
 </style>
</head>
<body>
<h1>Dokumente</h1>
<ul>
  <li><a href="Boot.pdf">Boot</li>
  <li><a href="Motor.pdf">Motor</li>
</ul>
</body>
</html>
```

Now you only need an image file for the button with which this list should be called up in the future. You can find icons, for example, at [material icons](https://fonts.google.com/icons?icon.query=document&icon.size=24) <!--@@linkchanged-->.
As an example, take an icon and save it under the name "dokumente.svg" in the [Images](#images) section.

When you click on the file "dokumente.html", you get an extended dialog.

![Example UserApp](../../img/userfiles-example.png)
///caption
Example HTML file
///

Clicking on {{DB("DBUserApp")}} opens a dialog used to set up the documents as a [User App](../base/userapps.md).

![User App](../../img/userfiles-create-userapp.png)
///caption
Setting up User App
///
Fill in the marked values, select the uploaded icon under *icon*, and save with {{DB("DBOk")}}.

In the {{BT("AddonConfigAddOns")}} tab, you will now be able to see the new User App with the chosen icon. By clicking on the icon, you can display the newly built page.

You will find the newly created button later under
{{MM("MMaddonpage")}}.