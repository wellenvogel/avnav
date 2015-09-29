namespace AvChartConvert
{
    partial class Form1
    {
        /// <summary>
        /// Erforderliche Designervariable.
        /// </summary>
        private System.ComponentModel.IContainer components = null;

        /// <summary>
        /// Verwendete Ressourcen bereinigen.
        /// </summary>
        /// <param name="disposing">True, wenn verwaltete Ressourcen gelöscht werden sollen; andernfalls False.</param>
        protected override void Dispose(bool disposing)
        {
            if (disposing && (components != null))
            {
                components.Dispose();
            }
            base.Dispose(disposing);
        }

        #region Vom Windows Form-Designer generierter Code

        /// <summary>
        /// Erforderliche Methode für die Designerunterstützung.
        /// Der Inhalt der Methode darf nicht mit dem Code-Editor geändert werden.
        /// </summary>
        private void InitializeComponent()
        {
            this.components = new System.ComponentModel.Container();
            System.ComponentModel.ComponentResourceManager resources = new System.ComponentModel.ComponentResourceManager(typeof(Form1));
            this.textIn = new System.Windows.Forms.TextBox();
            this.label1 = new System.Windows.Forms.Label();
            this.openInputDialog = new System.Windows.Forms.OpenFileDialog();
            this.buttonAddFile = new System.Windows.Forms.Button();
            this.buttonOK = new System.Windows.Forms.Button();
            this.buttonCancel = new System.Windows.Forms.Button();
            this.checkBoxUpdate = new System.Windows.Forms.CheckBox();
            this.textOutdir = new System.Windows.Forms.TextBox();
            this.label2 = new System.Windows.Forms.Label();
            this.buttonOutDir = new System.Windows.Forms.Button();
            this.folderBrowserInput = new System.Windows.Forms.FolderBrowserDialog();
            this.buttonAddDirectories = new System.Windows.Forms.Button();
            this.folderBrowserOutput = new System.Windows.Forms.FolderBrowserDialog();
            this.timer1 = new System.Windows.Forms.Timer(this.components);
            this.buttonStop = new System.Windows.Forms.Button();
            this.buttonEmpty = new System.Windows.Forms.Button();
            this.buttonDefaultOut = new System.Windows.Forms.Button();
            this.buttonFocus = new System.Windows.Forms.Button();
            this.labelProcess = new System.Windows.Forms.Label();
            this.textOpenCPN = new System.Windows.Forms.TextBox();
            this.labelOpenCPN = new System.Windows.Forms.Label();
            this.buttonOpenCPN = new System.Windows.Forms.Button();
            this.checkStartServer = new System.Windows.Forms.CheckBox();
            this.btnStopServer = new System.Windows.Forms.Button();
            this.btnStartServer = new System.Windows.Forms.Button();
            this.lbServerRunning = new System.Windows.Forms.Label();
            this.timer2 = new System.Windows.Forms.Timer(this.components);
            this.checkUseCmd = new System.Windows.Forms.CheckBox();
            this.label3 = new System.Windows.Forms.Label();
            this.panel1 = new System.Windows.Forms.Panel();
            this.tbUrl = new System.Windows.Forms.TextBox();
            this.cbBrowser = new System.Windows.Forms.CheckBox();
            this.panel2 = new System.Windows.Forms.Panel();
            this.btViewLog = new System.Windows.Forms.Button();
            this.btLogFile = new System.Windows.Forms.Button();
            this.tbLogFile = new System.Windows.Forms.TextBox();
            this.cbLogFile = new System.Windows.Forms.CheckBox();
            this.openOutputDialog = new System.Windows.Forms.SaveFileDialog();
            this.cbNewGemf = new System.Windows.Forms.CheckBox();
            this.panel1.SuspendLayout();
            this.panel2.SuspendLayout();
            this.SuspendLayout();
            // 
            // textIn
            // 
            this.textIn.Anchor = ((System.Windows.Forms.AnchorStyles)((((System.Windows.Forms.AnchorStyles.Top | System.Windows.Forms.AnchorStyles.Bottom) 
            | System.Windows.Forms.AnchorStyles.Left) 
            | System.Windows.Forms.AnchorStyles.Right)));
            this.textIn.Location = new System.Drawing.Point(19, 44);
            this.textIn.Margin = new System.Windows.Forms.Padding(4);
            this.textIn.Multiline = true;
            this.textIn.Name = "textIn";
            this.textIn.Size = new System.Drawing.Size(664, 446);
            this.textIn.TabIndex = 0;
            // 
            // label1
            // 
            this.label1.AutoSize = true;
            this.label1.Location = new System.Drawing.Point(16, 11);
            this.label1.Margin = new System.Windows.Forms.Padding(4, 0, 4, 0);
            this.label1.Name = "label1";
            this.label1.Size = new System.Drawing.Size(68, 17);
            this.label1.TabIndex = 1;
            this.label1.Text = "InputFiles";
            // 
            // openInputDialog
            // 
            this.openInputDialog.FileName = "openFileDialog1";
            // 
            // buttonAddFile
            // 
            this.buttonAddFile.Anchor = ((System.Windows.Forms.AnchorStyles)((System.Windows.Forms.AnchorStyles.Top | System.Windows.Forms.AnchorStyles.Right)));
            this.buttonAddFile.Location = new System.Drawing.Point(716, 78);
            this.buttonAddFile.Margin = new System.Windows.Forms.Padding(4);
            this.buttonAddFile.Name = "buttonAddFile";
            this.buttonAddFile.Size = new System.Drawing.Size(125, 28);
            this.buttonAddFile.TabIndex = 2;
            this.buttonAddFile.Text = "AddFile(s)";
            this.buttonAddFile.UseVisualStyleBackColor = true;
            this.buttonAddFile.Click += new System.EventHandler(this.buttonAddFile_Click);
            // 
            // buttonOK
            // 
            this.buttonOK.Anchor = ((System.Windows.Forms.AnchorStyles)(((System.Windows.Forms.AnchorStyles.Top | System.Windows.Forms.AnchorStyles.Bottom) 
            | System.Windows.Forms.AnchorStyles.Right)));
            this.buttonOK.Location = new System.Drawing.Point(742, 8);
            this.buttonOK.Margin = new System.Windows.Forms.Padding(4);
            this.buttonOK.Name = "buttonOK";
            this.buttonOK.Size = new System.Drawing.Size(100, 28);
            this.buttonOK.TabIndex = 3;
            this.buttonOK.Text = "Convert";
            this.buttonOK.UseVisualStyleBackColor = true;
            this.buttonOK.Click += new System.EventHandler(this.buttonOK_Click);
            // 
            // buttonCancel
            // 
            this.buttonCancel.Anchor = ((System.Windows.Forms.AnchorStyles)((System.Windows.Forms.AnchorStyles.Bottom | System.Windows.Forms.AnchorStyles.Right)));
            this.buttonCancel.Location = new System.Drawing.Point(742, 823);
            this.buttonCancel.Margin = new System.Windows.Forms.Padding(4);
            this.buttonCancel.Name = "buttonCancel";
            this.buttonCancel.Size = new System.Drawing.Size(100, 28);
            this.buttonCancel.TabIndex = 4;
            this.buttonCancel.Text = "Exit";
            this.buttonCancel.UseVisualStyleBackColor = true;
            this.buttonCancel.Click += new System.EventHandler(this.buttonCancel_Click);
            // 
            // checkBoxUpdate
            // 
            this.checkBoxUpdate.Anchor = ((System.Windows.Forms.AnchorStyles)(((System.Windows.Forms.AnchorStyles.Top | System.Windows.Forms.AnchorStyles.Bottom) 
            | System.Windows.Forms.AnchorStyles.Left)));
            this.checkBoxUpdate.AutoSize = true;
            this.checkBoxUpdate.Checked = true;
            this.checkBoxUpdate.CheckState = System.Windows.Forms.CheckState.Checked;
            this.checkBoxUpdate.Location = new System.Drawing.Point(15, 13);
            this.checkBoxUpdate.Margin = new System.Windows.Forms.Padding(4);
            this.checkBoxUpdate.Name = "checkBoxUpdate";
            this.checkBoxUpdate.Size = new System.Drawing.Size(109, 21);
            this.checkBoxUpdate.TabIndex = 5;
            this.checkBoxUpdate.Text = "updateMode";
            this.checkBoxUpdate.UseVisualStyleBackColor = true;
            // 
            // textOutdir
            // 
            this.textOutdir.Anchor = ((System.Windows.Forms.AnchorStyles)(((System.Windows.Forms.AnchorStyles.Bottom | System.Windows.Forms.AnchorStyles.Left) 
            | System.Windows.Forms.AnchorStyles.Right)));
            this.textOutdir.Location = new System.Drawing.Point(19, 531);
            this.textOutdir.Margin = new System.Windows.Forms.Padding(4);
            this.textOutdir.Name = "textOutdir";
            this.textOutdir.Size = new System.Drawing.Size(664, 22);
            this.textOutdir.TabIndex = 6;
            this.textOutdir.TextChanged += new System.EventHandler(this.textOutdir_TextChanged);
            // 
            // label2
            // 
            this.label2.Anchor = ((System.Windows.Forms.AnchorStyles)((System.Windows.Forms.AnchorStyles.Bottom | System.Windows.Forms.AnchorStyles.Left)));
            this.label2.AutoSize = true;
            this.label2.Location = new System.Drawing.Point(16, 511);
            this.label2.Margin = new System.Windows.Forms.Padding(4, 0, 4, 0);
            this.label2.Name = "label2";
            this.label2.Size = new System.Drawing.Size(69, 17);
            this.label2.TabIndex = 7;
            this.label2.Text = "OutputDir";
            // 
            // buttonOutDir
            // 
            this.buttonOutDir.Anchor = ((System.Windows.Forms.AnchorStyles)((System.Windows.Forms.AnchorStyles.Bottom | System.Windows.Forms.AnchorStyles.Right)));
            this.buttonOutDir.Location = new System.Drawing.Point(692, 531);
            this.buttonOutDir.Margin = new System.Windows.Forms.Padding(4);
            this.buttonOutDir.Name = "buttonOutDir";
            this.buttonOutDir.Size = new System.Drawing.Size(72, 28);
            this.buttonOutDir.TabIndex = 8;
            this.buttonOutDir.Text = "Change";
            this.buttonOutDir.UseVisualStyleBackColor = true;
            this.buttonOutDir.Click += new System.EventHandler(this.buttonOutDir_Click);
            // 
            // buttonAddDirectories
            // 
            this.buttonAddDirectories.Anchor = ((System.Windows.Forms.AnchorStyles)((System.Windows.Forms.AnchorStyles.Top | System.Windows.Forms.AnchorStyles.Right)));
            this.buttonAddDirectories.Location = new System.Drawing.Point(716, 42);
            this.buttonAddDirectories.Margin = new System.Windows.Forms.Padding(4);
            this.buttonAddDirectories.Name = "buttonAddDirectories";
            this.buttonAddDirectories.Size = new System.Drawing.Size(125, 28);
            this.buttonAddDirectories.TabIndex = 9;
            this.buttonAddDirectories.Text = "AddDirectories";
            this.buttonAddDirectories.UseVisualStyleBackColor = true;
            this.buttonAddDirectories.Click += new System.EventHandler(this.buttonAddDirectories_Click);
            // 
            // timer1
            // 
            this.timer1.Enabled = true;
            this.timer1.Interval = 500;
            this.timer1.Tick += new System.EventHandler(this.timer1_Tick);
            // 
            // buttonStop
            // 
            this.buttonStop.Anchor = ((System.Windows.Forms.AnchorStyles)(((System.Windows.Forms.AnchorStyles.Top | System.Windows.Forms.AnchorStyles.Bottom) 
            | System.Windows.Forms.AnchorStyles.Right)));
            this.buttonStop.Location = new System.Drawing.Point(635, 8);
            this.buttonStop.Margin = new System.Windows.Forms.Padding(4);
            this.buttonStop.Name = "buttonStop";
            this.buttonStop.Size = new System.Drawing.Size(100, 28);
            this.buttonStop.TabIndex = 10;
            this.buttonStop.Text = "Stop";
            this.buttonStop.UseVisualStyleBackColor = true;
            this.buttonStop.Visible = false;
            this.buttonStop.Click += new System.EventHandler(this.buttonStop_Click);
            // 
            // buttonEmpty
            // 
            this.buttonEmpty.Anchor = ((System.Windows.Forms.AnchorStyles)((System.Windows.Forms.AnchorStyles.Top | System.Windows.Forms.AnchorStyles.Right)));
            this.buttonEmpty.Location = new System.Drawing.Point(716, 128);
            this.buttonEmpty.Margin = new System.Windows.Forms.Padding(4);
            this.buttonEmpty.Name = "buttonEmpty";
            this.buttonEmpty.Size = new System.Drawing.Size(125, 30);
            this.buttonEmpty.TabIndex = 11;
            this.buttonEmpty.Text = "Empty";
            this.buttonEmpty.UseVisualStyleBackColor = true;
            this.buttonEmpty.Click += new System.EventHandler(this.buttonEmpty_Click);
            // 
            // buttonDefaultOut
            // 
            this.buttonDefaultOut.Anchor = ((System.Windows.Forms.AnchorStyles)((System.Windows.Forms.AnchorStyles.Bottom | System.Windows.Forms.AnchorStyles.Right)));
            this.buttonDefaultOut.Location = new System.Drawing.Point(772, 531);
            this.buttonDefaultOut.Margin = new System.Windows.Forms.Padding(4);
            this.buttonDefaultOut.Name = "buttonDefaultOut";
            this.buttonDefaultOut.Size = new System.Drawing.Size(69, 28);
            this.buttonDefaultOut.TabIndex = 12;
            this.buttonDefaultOut.Text = "Default";
            this.buttonDefaultOut.UseVisualStyleBackColor = true;
            this.buttonDefaultOut.Click += new System.EventHandler(this.buttonDefaultOut_Click);
            // 
            // buttonFocus
            // 
            this.buttonFocus.Anchor = ((System.Windows.Forms.AnchorStyles)(((System.Windows.Forms.AnchorStyles.Top | System.Windows.Forms.AnchorStyles.Bottom) 
            | System.Windows.Forms.AnchorStyles.Right)));
            this.buttonFocus.Location = new System.Drawing.Point(527, 8);
            this.buttonFocus.Margin = new System.Windows.Forms.Padding(4);
            this.buttonFocus.Name = "buttonFocus";
            this.buttonFocus.Size = new System.Drawing.Size(100, 28);
            this.buttonFocus.TabIndex = 13;
            this.buttonFocus.Text = "Focus";
            this.buttonFocus.UseVisualStyleBackColor = true;
            this.buttonFocus.Visible = false;
            this.buttonFocus.Click += new System.EventHandler(this.buttonFocus_Click);
            // 
            // labelProcess
            // 
            this.labelProcess.Anchor = ((System.Windows.Forms.AnchorStyles)((((System.Windows.Forms.AnchorStyles.Top | System.Windows.Forms.AnchorStyles.Bottom) 
            | System.Windows.Forms.AnchorStyles.Left) 
            | System.Windows.Forms.AnchorStyles.Right)));
            this.labelProcess.AutoSize = true;
            this.labelProcess.Location = new System.Drawing.Point(182, 13);
            this.labelProcess.Margin = new System.Windows.Forms.Padding(4, 0, 4, 0);
            this.labelProcess.Name = "labelProcess";
            this.labelProcess.Size = new System.Drawing.Size(0, 17);
            this.labelProcess.TabIndex = 14;
            // 
            // textOpenCPN
            // 
            this.textOpenCPN.Anchor = ((System.Windows.Forms.AnchorStyles)(((System.Windows.Forms.AnchorStyles.Bottom | System.Windows.Forms.AnchorStyles.Left) 
            | System.Windows.Forms.AnchorStyles.Right)));
            this.textOpenCPN.Location = new System.Drawing.Point(19, 584);
            this.textOpenCPN.Margin = new System.Windows.Forms.Padding(4);
            this.textOpenCPN.Name = "textOpenCPN";
            this.textOpenCPN.Size = new System.Drawing.Size(664, 22);
            this.textOpenCPN.TabIndex = 15;
            // 
            // labelOpenCPN
            // 
            this.labelOpenCPN.Anchor = ((System.Windows.Forms.AnchorStyles)((System.Windows.Forms.AnchorStyles.Bottom | System.Windows.Forms.AnchorStyles.Left)));
            this.labelOpenCPN.AutoSize = true;
            this.labelOpenCPN.Location = new System.Drawing.Point(16, 564);
            this.labelOpenCPN.Margin = new System.Windows.Forms.Padding(4, 0, 4, 0);
            this.labelOpenCPN.Name = "labelOpenCPN";
            this.labelOpenCPN.Size = new System.Drawing.Size(125, 17);
            this.labelOpenCPN.TabIndex = 16;
            this.labelOpenCPN.Text = "OpenCPNLocation";
            // 
            // buttonOpenCPN
            // 
            this.buttonOpenCPN.Anchor = ((System.Windows.Forms.AnchorStyles)((System.Windows.Forms.AnchorStyles.Bottom | System.Windows.Forms.AnchorStyles.Right)));
            this.buttonOpenCPN.Location = new System.Drawing.Point(692, 581);
            this.buttonOpenCPN.Margin = new System.Windows.Forms.Padding(4);
            this.buttonOpenCPN.Name = "buttonOpenCPN";
            this.buttonOpenCPN.Size = new System.Drawing.Size(72, 28);
            this.buttonOpenCPN.TabIndex = 17;
            this.buttonOpenCPN.Text = "Change";
            this.buttonOpenCPN.UseVisualStyleBackColor = true;
            this.buttonOpenCPN.Click += new System.EventHandler(this.buttonOpenCPN_Click);
            // 
            // checkStartServer
            // 
            this.checkStartServer.AutoSize = true;
            this.checkStartServer.Checked = true;
            this.checkStartServer.CheckState = System.Windows.Forms.CheckState.Checked;
            this.checkStartServer.Location = new System.Drawing.Point(15, 19);
            this.checkStartServer.Margin = new System.Windows.Forms.Padding(4);
            this.checkStartServer.Name = "checkStartServer";
            this.checkStartServer.Size = new System.Drawing.Size(130, 21);
            this.checkStartServer.TabIndex = 18;
            this.checkStartServer.Text = "autoStartServer";
            this.checkStartServer.UseVisualStyleBackColor = true;
            // 
            // btnStopServer
            // 
            this.btnStopServer.Anchor = ((System.Windows.Forms.AnchorStyles)((System.Windows.Forms.AnchorStyles.Top | System.Windows.Forms.AnchorStyles.Right)));
            this.btnStopServer.Location = new System.Drawing.Point(635, 14);
            this.btnStopServer.Margin = new System.Windows.Forms.Padding(4);
            this.btnStopServer.Name = "btnStopServer";
            this.btnStopServer.Size = new System.Drawing.Size(100, 28);
            this.btnStopServer.TabIndex = 19;
            this.btnStopServer.Text = "StopServer";
            this.btnStopServer.UseVisualStyleBackColor = true;
            this.btnStopServer.Visible = false;
            this.btnStopServer.Click += new System.EventHandler(this.btnStopServer_Click);
            // 
            // btnStartServer
            // 
            this.btnStartServer.Anchor = ((System.Windows.Forms.AnchorStyles)((System.Windows.Forms.AnchorStyles.Top | System.Windows.Forms.AnchorStyles.Right)));
            this.btnStartServer.Location = new System.Drawing.Point(743, 14);
            this.btnStartServer.Margin = new System.Windows.Forms.Padding(4);
            this.btnStartServer.Name = "btnStartServer";
            this.btnStartServer.Size = new System.Drawing.Size(100, 28);
            this.btnStartServer.TabIndex = 20;
            this.btnStartServer.Text = "StartServer";
            this.btnStartServer.UseVisualStyleBackColor = true;
            this.btnStartServer.Click += new System.EventHandler(this.btnStartServer_Click);
            // 
            // lbServerRunning
            // 
            this.lbServerRunning.Anchor = ((System.Windows.Forms.AnchorStyles)(((System.Windows.Forms.AnchorStyles.Top | System.Windows.Forms.AnchorStyles.Left) 
            | System.Windows.Forms.AnchorStyles.Right)));
            this.lbServerRunning.AutoSize = true;
            this.lbServerRunning.ForeColor = System.Drawing.Color.FromArgb(((int)(((byte)(192)))), ((int)(((byte)(0)))), ((int)(((byte)(0)))));
            this.lbServerRunning.Location = new System.Drawing.Point(284, 20);
            this.lbServerRunning.Margin = new System.Windows.Forms.Padding(4, 0, 4, 0);
            this.lbServerRunning.Name = "lbServerRunning";
            this.lbServerRunning.Size = new System.Drawing.Size(105, 17);
            this.lbServerRunning.TabIndex = 21;
            this.lbServerRunning.Text = "Server stopped";
            // 
            // timer2
            // 
            this.timer2.Enabled = true;
            this.timer2.Interval = 500;
            this.timer2.Tick += new System.EventHandler(this.timer2_Tick);
            // 
            // checkUseCmd
            // 
            this.checkUseCmd.Anchor = ((System.Windows.Forms.AnchorStyles)((System.Windows.Forms.AnchorStyles.Bottom | System.Windows.Forms.AnchorStyles.Left)));
            this.checkUseCmd.AutoSize = true;
            this.checkUseCmd.Location = new System.Drawing.Point(19, 628);
            this.checkUseCmd.Margin = new System.Windows.Forms.Padding(4);
            this.checkUseCmd.Name = "checkUseCmd";
            this.checkUseCmd.Size = new System.Drawing.Size(103, 21);
            this.checkUseCmd.TabIndex = 22;
            this.checkUseCmd.Text = "useCmdFile";
            this.checkUseCmd.UseVisualStyleBackColor = true;
            // 
            // label3
            // 
            this.label3.Anchor = ((System.Windows.Forms.AnchorStyles)(((System.Windows.Forms.AnchorStyles.Bottom | System.Windows.Forms.AnchorStyles.Left) 
            | System.Windows.Forms.AnchorStyles.Right)));
            this.label3.AutoSize = true;
            this.label3.Location = new System.Drawing.Point(145, 628);
            this.label3.Margin = new System.Windows.Forms.Padding(4, 0, 4, 0);
            this.label3.Name = "label3";
            this.label3.Size = new System.Drawing.Size(334, 17);
            this.label3.TabIndex = 23;
            this.label3.Text = "check this if python is not found and adapt cmd files";
            // 
            // panel1
            // 
            this.panel1.Anchor = ((System.Windows.Forms.AnchorStyles)(((System.Windows.Forms.AnchorStyles.Bottom | System.Windows.Forms.AnchorStyles.Left) 
            | System.Windows.Forms.AnchorStyles.Right)));
            this.panel1.BorderStyle = System.Windows.Forms.BorderStyle.FixedSingle;
            this.panel1.Controls.Add(this.tbUrl);
            this.panel1.Controls.Add(this.cbBrowser);
            this.panel1.Controls.Add(this.lbServerRunning);
            this.panel1.Controls.Add(this.btnStartServer);
            this.panel1.Controls.Add(this.btnStopServer);
            this.panel1.Controls.Add(this.checkStartServer);
            this.panel1.Location = new System.Drawing.Point(-2, 737);
            this.panel1.Margin = new System.Windows.Forms.Padding(4);
            this.panel1.Name = "panel1";
            this.panel1.Size = new System.Drawing.Size(875, 78);
            this.panel1.TabIndex = 24;
            // 
            // tbUrl
            // 
            this.tbUrl.Anchor = ((System.Windows.Forms.AnchorStyles)(((System.Windows.Forms.AnchorStyles.Top | System.Windows.Forms.AnchorStyles.Left) 
            | System.Windows.Forms.AnchorStyles.Right)));
            this.tbUrl.Location = new System.Drawing.Point(158, 46);
            this.tbUrl.Margin = new System.Windows.Forms.Padding(4);
            this.tbUrl.Name = "tbUrl";
            this.tbUrl.Size = new System.Drawing.Size(359, 22);
            this.tbUrl.TabIndex = 23;
            this.tbUrl.TextChanged += new System.EventHandler(this.tbUrl_TextChanged);
            // 
            // cbBrowser
            // 
            this.cbBrowser.AutoSize = true;
            this.cbBrowser.Checked = true;
            this.cbBrowser.CheckState = System.Windows.Forms.CheckState.Checked;
            this.cbBrowser.Location = new System.Drawing.Point(15, 48);
            this.cbBrowser.Margin = new System.Windows.Forms.Padding(4);
            this.cbBrowser.Name = "cbBrowser";
            this.cbBrowser.Size = new System.Drawing.Size(109, 21);
            this.cbBrowser.TabIndex = 22;
            this.cbBrowser.Text = "startBrowser";
            this.cbBrowser.UseVisualStyleBackColor = true;
            // 
            // panel2
            // 
            this.panel2.Anchor = ((System.Windows.Forms.AnchorStyles)(((System.Windows.Forms.AnchorStyles.Bottom | System.Windows.Forms.AnchorStyles.Left) 
            | System.Windows.Forms.AnchorStyles.Right)));
            this.panel2.BorderStyle = System.Windows.Forms.BorderStyle.FixedSingle;
            this.panel2.Controls.Add(this.cbNewGemf);
            this.panel2.Controls.Add(this.btViewLog);
            this.panel2.Controls.Add(this.btLogFile);
            this.panel2.Controls.Add(this.tbLogFile);
            this.panel2.Controls.Add(this.cbLogFile);
            this.panel2.Controls.Add(this.checkBoxUpdate);
            this.panel2.Controls.Add(this.buttonFocus);
            this.panel2.Controls.Add(this.buttonStop);
            this.panel2.Controls.Add(this.labelProcess);
            this.panel2.Controls.Add(this.buttonOK);
            this.panel2.Location = new System.Drawing.Point(-2, 656);
            this.panel2.Name = "panel2";
            this.panel2.Size = new System.Drawing.Size(875, 87);
            this.panel2.TabIndex = 25;
            // 
            // btViewLog
            // 
            this.btViewLog.Anchor = ((System.Windows.Forms.AnchorStyles)(((System.Windows.Forms.AnchorStyles.Top | System.Windows.Forms.AnchorStyles.Bottom) 
            | System.Windows.Forms.AnchorStyles.Right)));
            this.btViewLog.Location = new System.Drawing.Point(635, 44);
            this.btViewLog.Margin = new System.Windows.Forms.Padding(4);
            this.btViewLog.Name = "btViewLog";
            this.btViewLog.Size = new System.Drawing.Size(100, 28);
            this.btViewLog.TabIndex = 19;
            this.btViewLog.Text = "View";
            this.btViewLog.UseVisualStyleBackColor = true;
            this.btViewLog.Click += new System.EventHandler(this.btViewLog_Click);
            // 
            // btLogFile
            // 
            this.btLogFile.Anchor = ((System.Windows.Forms.AnchorStyles)(((System.Windows.Forms.AnchorStyles.Top | System.Windows.Forms.AnchorStyles.Bottom) 
            | System.Windows.Forms.AnchorStyles.Right)));
            this.btLogFile.Location = new System.Drawing.Point(742, 44);
            this.btLogFile.Margin = new System.Windows.Forms.Padding(4);
            this.btLogFile.Name = "btLogFile";
            this.btLogFile.Size = new System.Drawing.Size(100, 28);
            this.btLogFile.TabIndex = 18;
            this.btLogFile.Text = "Change";
            this.btLogFile.UseVisualStyleBackColor = true;
            this.btLogFile.Click += new System.EventHandler(this.btLogFile_Click);
            // 
            // tbLogFile
            // 
            this.tbLogFile.Anchor = ((System.Windows.Forms.AnchorStyles)((((System.Windows.Forms.AnchorStyles.Top | System.Windows.Forms.AnchorStyles.Bottom) 
            | System.Windows.Forms.AnchorStyles.Left) 
            | System.Windows.Forms.AnchorStyles.Right)));
            this.tbLogFile.Location = new System.Drawing.Point(94, 47);
            this.tbLogFile.Margin = new System.Windows.Forms.Padding(4);
            this.tbLogFile.Name = "tbLogFile";
            this.tbLogFile.Size = new System.Drawing.Size(532, 22);
            this.tbLogFile.TabIndex = 16;
            // 
            // cbLogFile
            // 
            this.cbLogFile.Anchor = ((System.Windows.Forms.AnchorStyles)(((System.Windows.Forms.AnchorStyles.Top | System.Windows.Forms.AnchorStyles.Bottom) 
            | System.Windows.Forms.AnchorStyles.Left)));
            this.cbLogFile.AutoSize = true;
            this.cbLogFile.Checked = true;
            this.cbLogFile.CheckState = System.Windows.Forms.CheckState.Checked;
            this.cbLogFile.Location = new System.Drawing.Point(15, 48);
            this.cbLogFile.Margin = new System.Windows.Forms.Padding(4);
            this.cbLogFile.Name = "cbLogFile";
            this.cbLogFile.Size = new System.Drawing.Size(71, 21);
            this.cbLogFile.TabIndex = 14;
            this.cbLogFile.Text = "logFile";
            this.cbLogFile.UseVisualStyleBackColor = true;
            // 
            // cbNewGemf
            // 
            this.cbNewGemf.Anchor = ((System.Windows.Forms.AnchorStyles)(((System.Windows.Forms.AnchorStyles.Top | System.Windows.Forms.AnchorStyles.Bottom) 
            | System.Windows.Forms.AnchorStyles.Left)));
            this.cbNewGemf.AutoSize = true;
            this.cbNewGemf.Checked = true;
            this.cbNewGemf.CheckState = System.Windows.Forms.CheckState.Checked;
            this.cbNewGemf.Location = new System.Drawing.Point(132, 13);
            this.cbNewGemf.Margin = new System.Windows.Forms.Padding(4);
            this.cbNewGemf.Name = "cbNewGemf";
            this.cbNewGemf.Size = new System.Drawing.Size(89, 21);
            this.cbNewGemf.TabIndex = 20;
            this.cbNewGemf.Text = "newGemf";
            this.cbNewGemf.UseVisualStyleBackColor = true;
            // 
            // Form1
            // 
            this.AutoScaleDimensions = new System.Drawing.SizeF(8F, 16F);
            this.AutoScaleMode = System.Windows.Forms.AutoScaleMode.Font;
            this.ClientSize = new System.Drawing.Size(863, 860);
            this.Controls.Add(this.panel2);
            this.Controls.Add(this.panel1);
            this.Controls.Add(this.label3);
            this.Controls.Add(this.checkUseCmd);
            this.Controls.Add(this.buttonOpenCPN);
            this.Controls.Add(this.labelOpenCPN);
            this.Controls.Add(this.textOpenCPN);
            this.Controls.Add(this.buttonDefaultOut);
            this.Controls.Add(this.buttonEmpty);
            this.Controls.Add(this.buttonAddDirectories);
            this.Controls.Add(this.buttonOutDir);
            this.Controls.Add(this.label2);
            this.Controls.Add(this.textOutdir);
            this.Controls.Add(this.buttonCancel);
            this.Controls.Add(this.buttonAddFile);
            this.Controls.Add(this.label1);
            this.Controls.Add(this.textIn);
            this.Icon = ((System.Drawing.Icon)(resources.GetObject("$this.Icon")));
            this.Margin = new System.Windows.Forms.Padding(4);
            this.MinimumSize = new System.Drawing.Size(500, 600);
            this.Name = "Form1";
            this.Text = "AvChartConvert";
            this.FormClosing += new System.Windows.Forms.FormClosingEventHandler(this.Form1_FormClosing);
            this.panel1.ResumeLayout(false);
            this.panel1.PerformLayout();
            this.panel2.ResumeLayout(false);
            this.panel2.PerformLayout();
            this.ResumeLayout(false);
            this.PerformLayout();

        }

        #endregion

        private System.Windows.Forms.TextBox textIn;
        private System.Windows.Forms.Label label1;
        private System.Windows.Forms.OpenFileDialog openInputDialog;
        private System.Windows.Forms.Button buttonAddFile;
        private System.Windows.Forms.Button buttonOK;
        private System.Windows.Forms.Button buttonCancel;
        private System.Windows.Forms.CheckBox checkBoxUpdate;
        private System.Windows.Forms.TextBox textOutdir;
        private System.Windows.Forms.Label label2;
        private System.Windows.Forms.Button buttonOutDir;
        private System.Windows.Forms.FolderBrowserDialog folderBrowserInput;
        private System.Windows.Forms.Button buttonAddDirectories;
        private System.Windows.Forms.FolderBrowserDialog folderBrowserOutput;
        private System.Windows.Forms.Timer timer1;
        private System.Windows.Forms.Button buttonStop;
        private System.Windows.Forms.Button buttonEmpty;
        private System.Windows.Forms.Button buttonDefaultOut;
        private System.Windows.Forms.Button buttonFocus;
        private System.Windows.Forms.Label labelProcess;
        private System.Windows.Forms.TextBox textOpenCPN;
        private System.Windows.Forms.Label labelOpenCPN;
        private System.Windows.Forms.Button buttonOpenCPN;
        private System.Windows.Forms.CheckBox checkStartServer;
        private System.Windows.Forms.Button btnStopServer;
        private System.Windows.Forms.Button btnStartServer;
        private System.Windows.Forms.Label lbServerRunning;
        private System.Windows.Forms.Timer timer2;
        private System.Windows.Forms.CheckBox checkUseCmd;
        private System.Windows.Forms.Label label3;
        private System.Windows.Forms.Panel panel1;
        private System.Windows.Forms.Panel panel2;
        private System.Windows.Forms.Button btLogFile;
        private System.Windows.Forms.TextBox tbLogFile;
        private System.Windows.Forms.CheckBox cbLogFile;
        private System.Windows.Forms.SaveFileDialog openOutputDialog;
        private System.Windows.Forms.Button btViewLog;
        private System.Windows.Forms.CheckBox cbBrowser;
        private System.Windows.Forms.TextBox tbUrl;
        private System.Windows.Forms.CheckBox cbNewGemf;
    }
}

