<#
.SYNOPSIS
Prompts the user with a multi-line input box and returns the text they enter, or null if they cancelled the prompt.
 
.DESCRIPTION
Prompts the user with a multi-line input box and returns the text they enter, or null if they cancelled the prompt.
 
.PARAMETER Message
The message to display to the user explaining what text we are asking them to enter.
 
.PARAMETER WindowTitle
The text to display on the prompt window's title.
 
.PARAMETER DefaultText
The default text to show in the input box.

.PARAMETER ShowText
If false - do not show a text input (use for confirm dialog)
 
.EXAMPLE
$userText = Show-InputDialog "Input some text please:" "Get User's Input"
 
Shows how to create a simple prompt to get mutli-line input from a user.
 
.EXAMPLE
# Setup the default multi-line address to fill the input box with.
$defaultAddress = @'
John Doe
123 St.
Some Town, SK, Canada
A1B 2C3
'@
 
$address = Show-InputDialog "Please enter your full address, including name, street, city, and postal code:" "Get User's Address" $defaultAddress
if ($address -eq $null)
{
    Write-Error "You pressed the Cancel button on the multi-line input box."
}
 
Prompts the user for their address and stores it in a variable, pre-filling the input box with a default multi-line address.
If the user pressed the Cancel button an error is written to the console.
 
.EXAMPLE
$inputText = Show-InputDialog -Message "If you have a really long message you can break it apart`nover two lines with the powershell newline character:" -WindowTitle "Window Title" -DefaultText "Default text for the input box."
 
Shows how to break the second parameter (Message) up onto two lines using the powershell newline character (`n).
If you break the message up into more than two lines the extra lines will be hidden behind or show ontop of the TextBox.
 
.NOTES
Name: Show-MultiLineInputDialog
Author: Daniel Schroeder (originally based on the code shown at http://technet.microsoft.com/en-us/library/ff730941.aspx)
Version: 1.0
#>
function Show-InputDialog([string]$Message, [string]$WindowTitle = "Please enter some text.", [string]$DefaultText="",[bool]$ShowText=$true)
{
    

    Add-Type -AssemblyName System.Drawing
    Add-Type -AssemblyName System.Windows.Forms
    $buttonSize=New-Object System.Drawing.Size(75,25)
    # Create the Label.
    $label = New-Object System.Windows.Forms.Label
    $label.Dock='Top'
    $label.AutoSize = $true
    $label.Text = $Message
    $textBox=$null
    if ($ShowText) {
        # Create the TextBox used to capture the user's text.
        $textBox = New-Object System.Windows.Forms.TextBox
        $textBox.Dock = 'Top'
        $textBox.AutoSize = $true
        $textBox.AcceptsReturn = $true
        $textBox.AcceptsTab = $false
        $textBox.Multiline = $false
        $textBox.Text = $DefaultText
    }

    $buttonPanel=New-Object System.Windows.Forms.Panel
    $buttonPanel.Height=50
    $buttonPanel.Padding='10,10,10,10'
    $buttonPanel.Dock='Bottom'


    # Create the OK button.
    $okButton = New-Object System.Windows.Forms.Button
    $okButton.Size = $buttonSize
    $okButton.Dock='Right'
    $okButton.Text = "OK"
    $okButton.Add_Click({ 
        if ($ShowText){
            $form.Tag = $textBox.Text
        }
        else{
            $form.Tag=$DefaultText
        }
        $form.Close() })
    

    # Create the Cancel button.
    $cancelButton = New-Object System.Windows.Forms.Button
    $cancelButton.Size = $buttonSize
    $cancelButton.Text = "Cancel"
    $cancelButton.Dock='Right'
    $cancelButton.Add_Click({ $form.Tag = $null; $form.Close() })
    
    $buttonPanel.Controls.Add($cancelButton)
    $buttonPanel.Controls.Add($okButton)

    # Create the form.
    $form = New-Object System.Windows.Forms.Form
    $form.Text = $WindowTitle
    #$form.AutoSize=$true
    if ($ShowText){
        $form.Size = New-Object System.Drawing.Size(610,180)
    }
    else{
        $form.Size = New-Object System.Drawing.Size(610,130)
    }
    $form.FormBorderStyle = 'FixedSingle'
    $form.StartPosition = "CenterScreen"
    $form.AutoSizeMode = 'GrowAndShrink'
    $form.Padding='10,10,10,10'
    $form.Topmost = $True
    $form.AcceptButton = $okButton
    $form.CancelButton = $cancelButton
    $form.ShowInTaskbar = $true

    # Add all of the controls to the form.
    if ($ShowText) {
        $form.Controls.Add($textBox)
    }
    $form.Controls.Add($label)
    $form.Controls.Add($buttonPanel)


    # Initialize and show the form.
    $form.Add_Shown({$form.Activate()})
    $form.ShowDialog() > $null # Trash the text of the button that was clicked.

    # Return the text that the user entered.
    return $form.Tag
}

#Show-InputDialog -WindowTitle "Test" -Message "muss ja hier auch noch stehen" -DefaultText "short"