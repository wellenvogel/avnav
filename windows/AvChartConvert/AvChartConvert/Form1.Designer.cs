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
            this.buttonCancel = new System.Windows.Forms.Button();
            this.textOutdir = new System.Windows.Forms.TextBox();
            this.label2 = new System.Windows.Forms.Label();
            this.buttonOutDir = new System.Windows.Forms.Button();
            this.folderBrowserInput = new System.Windows.Forms.FolderBrowserDialog();
            this.buttonAddDirectories = new System.Windows.Forms.Button();
            this.folderBrowserOutput = new System.Windows.Forms.FolderBrowserDialog();
            this.timer1 = new System.Windows.Forms.Timer(this.components);
            this.buttonEmpty = new System.Windows.Forms.Button();
            this.buttonDefaultOut = new System.Windows.Forms.Button();
            this.textOpenCPN = new System.Windows.Forms.TextBox();
            this.labelOpenCPN = new System.Windows.Forms.Label();
            this.buttonOpenCPN = new System.Windows.Forms.Button();
            this.checkStartServer = new System.Windows.Forms.CheckBox();
            this.btnStopServer = new System.Windows.Forms.Button();
            this.btnStartServer = new System.Windows.Forms.Button();
            this.lbServerRunning = new System.Windows.Forms.Label();
            this.timer2 = new System.Windows.Forms.Timer(this.components);
            this.checkUseCmd = new System.Windows.Forms.CheckBox();
            this.lbCmd = new System.Windows.Forms.Label();
            this.btTestData = new System.Windows.Forms.Button();
            this.txTestData = new System.Windows.Forms.TextBox();
            this.cbTestData = new System.Windows.Forms.CheckBox();
            this.tbUrl = new System.Windows.Forms.TextBox();
            this.cbBrowser = new System.Windows.Forms.CheckBox();
            this.openOutputDialog = new System.Windows.Forms.SaveFileDialog();
            this.splitContainer1 = new System.Windows.Forms.SplitContainer();
            this.panel1 = new System.Windows.Forms.Panel();
            this.label3 = new System.Windows.Forms.Label();
            this.labelProcess = new System.Windows.Forms.Label();
            this.btLogFile = new System.Windows.Forms.Button();
            this.btViewLog = new System.Windows.Forms.Button();
            this.cbNewGemf = new System.Windows.Forms.CheckBox();
            this.tbLogFile = new System.Windows.Forms.TextBox();
            this.cbLogFile = new System.Windows.Forms.CheckBox();
            this.buttonStop = new System.Windows.Forms.Button();
            this.buttonOK = new System.Windows.Forms.Button();
            this.buttonFocus = new System.Windows.Forms.Button();
            this.checkBoxUpdate = new System.Windows.Forms.CheckBox();
            this.panel2 = new System.Windows.Forms.Panel();
            this.pUserConfig = new System.Windows.Forms.Panel();
            this.btEditUserConfig = new System.Windows.Forms.Button();
            this.label9 = new System.Windows.Forms.Label();
            this.btChangeUserConfig = new System.Windows.Forms.Button();
            this.txUserConfig = new System.Windows.Forms.TextBox();
            this.pServerMode = new System.Windows.Forms.Panel();
            this.rbModeCustom = new System.Windows.Forms.RadioButton();
            this.rbModeTest = new System.Windows.Forms.RadioButton();
            this.rbModeIP = new System.Windows.Forms.RadioButton();
            this.rbModeCom = new System.Windows.Forms.RadioButton();
            this.pIp = new System.Windows.Forms.Panel();
            this.label8 = new System.Windows.Forms.Label();
            this.txIpPort = new System.Windows.Forms.TextBox();
            this.label7 = new System.Windows.Forms.Label();
            this.txIpAddress = new System.Windows.Forms.TextBox();
            this.pCom = new System.Windows.Forms.Panel();
            this.btRefreshCom = new System.Windows.Forms.Button();
            this.label6 = new System.Windows.Forms.Label();
            this.lbComPort = new System.Windows.Forms.ListBox();
            this.pTestData = new System.Windows.Forms.Panel();
            this.label5 = new System.Windows.Forms.Label();
            this.label4 = new System.Windows.Forms.Label();
            ((System.ComponentModel.ISupportInitialize)(this.splitContainer1)).BeginInit();
            this.splitContainer1.Panel1.SuspendLayout();
            this.splitContainer1.Panel2.SuspendLayout();
            this.splitContainer1.SuspendLayout();
            this.panel1.SuspendLayout();
            this.panel2.SuspendLayout();
            this.pUserConfig.SuspendLayout();
            this.pServerMode.SuspendLayout();
            this.pIp.SuspendLayout();
            this.pCom.SuspendLayout();
            this.pTestData.SuspendLayout();
            this.SuspendLayout();
            // 
            // textIn
            // 
            this.textIn.Anchor = ((System.Windows.Forms.AnchorStyles)((((System.Windows.Forms.AnchorStyles.Top | System.Windows.Forms.AnchorStyles.Bottom) 
            | System.Windows.Forms.AnchorStyles.Left) 
            | System.Windows.Forms.AnchorStyles.Right)));
            this.textIn.Location = new System.Drawing.Point(10, 45);
            this.textIn.Margin = new System.Windows.Forms.Padding(4);
            this.textIn.Multiline = true;
            this.textIn.Name = "textIn";
            this.textIn.Size = new System.Drawing.Size(456, 151);
            this.textIn.TabIndex = 0;
            // 
            // label1
            // 
            this.label1.AutoSize = true;
            this.label1.Location = new System.Drawing.Point(14, 15);
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
            this.buttonAddFile.Location = new System.Drawing.Point(512, 78);
            this.buttonAddFile.Margin = new System.Windows.Forms.Padding(4);
            this.buttonAddFile.Name = "buttonAddFile";
            this.buttonAddFile.Size = new System.Drawing.Size(110, 28);
            this.buttonAddFile.TabIndex = 2;
            this.buttonAddFile.Text = "AddFile(s)";
            this.buttonAddFile.UseVisualStyleBackColor = true;
            this.buttonAddFile.Click += new System.EventHandler(this.buttonAddFile_Click);
            // 
            // buttonCancel
            // 
            this.buttonCancel.Anchor = ((System.Windows.Forms.AnchorStyles)(((System.Windows.Forms.AnchorStyles.Top | System.Windows.Forms.AnchorStyles.Left) 
            | System.Windows.Forms.AnchorStyles.Right)));
            this.buttonCancel.Location = new System.Drawing.Point(577, 503);
            this.buttonCancel.Margin = new System.Windows.Forms.Padding(4);
            this.buttonCancel.Name = "buttonCancel";
            this.buttonCancel.Size = new System.Drawing.Size(110, 28);
            this.buttonCancel.TabIndex = 4;
            this.buttonCancel.Text = "Exit";
            this.buttonCancel.UseVisualStyleBackColor = true;
            this.buttonCancel.Click += new System.EventHandler(this.buttonCancel_Click);
            // 
            // textOutdir
            // 
            this.textOutdir.Anchor = ((System.Windows.Forms.AnchorStyles)(((System.Windows.Forms.AnchorStyles.Bottom | System.Windows.Forms.AnchorStyles.Left) 
            | System.Windows.Forms.AnchorStyles.Right)));
            this.textOutdir.Location = new System.Drawing.Point(10, 220);
            this.textOutdir.Margin = new System.Windows.Forms.Padding(4);
            this.textOutdir.Name = "textOutdir";
            this.textOutdir.Size = new System.Drawing.Size(456, 22);
            this.textOutdir.TabIndex = 6;
            this.textOutdir.TextChanged += new System.EventHandler(this.textOutdir_TextChanged);
            // 
            // label2
            // 
            this.label2.Anchor = ((System.Windows.Forms.AnchorStyles)((System.Windows.Forms.AnchorStyles.Bottom | System.Windows.Forms.AnchorStyles.Left)));
            this.label2.AutoSize = true;
            this.label2.Location = new System.Drawing.Point(7, 199);
            this.label2.Margin = new System.Windows.Forms.Padding(4, 0, 4, 0);
            this.label2.Name = "label2";
            this.label2.Size = new System.Drawing.Size(69, 17);
            this.label2.TabIndex = 7;
            this.label2.Text = "OutputDir";
            // 
            // buttonOutDir
            // 
            this.buttonOutDir.Anchor = ((System.Windows.Forms.AnchorStyles)((System.Windows.Forms.AnchorStyles.Bottom | System.Windows.Forms.AnchorStyles.Right)));
            this.buttonOutDir.AutoSize = true;
            this.buttonOutDir.AutoSizeMode = System.Windows.Forms.AutoSizeMode.GrowAndShrink;
            this.buttonOutDir.Location = new System.Drawing.Point(474, 218);
            this.buttonOutDir.Margin = new System.Windows.Forms.Padding(4);
            this.buttonOutDir.Name = "buttonOutDir";
            this.buttonOutDir.Size = new System.Drawing.Size(30, 27);
            this.buttonOutDir.TabIndex = 8;
            this.buttonOutDir.Text = "...";
            this.buttonOutDir.UseVisualStyleBackColor = true;
            this.buttonOutDir.Click += new System.EventHandler(this.buttonOutDir_Click);
            // 
            // buttonAddDirectories
            // 
            this.buttonAddDirectories.Anchor = ((System.Windows.Forms.AnchorStyles)((System.Windows.Forms.AnchorStyles.Top | System.Windows.Forms.AnchorStyles.Right)));
            this.buttonAddDirectories.Location = new System.Drawing.Point(512, 42);
            this.buttonAddDirectories.Margin = new System.Windows.Forms.Padding(4);
            this.buttonAddDirectories.Name = "buttonAddDirectories";
            this.buttonAddDirectories.Size = new System.Drawing.Size(110, 28);
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
            // buttonEmpty
            // 
            this.buttonEmpty.Anchor = ((System.Windows.Forms.AnchorStyles)((System.Windows.Forms.AnchorStyles.Top | System.Windows.Forms.AnchorStyles.Right)));
            this.buttonEmpty.Location = new System.Drawing.Point(512, 166);
            this.buttonEmpty.Margin = new System.Windows.Forms.Padding(4);
            this.buttonEmpty.Name = "buttonEmpty";
            this.buttonEmpty.Size = new System.Drawing.Size(110, 28);
            this.buttonEmpty.TabIndex = 11;
            this.buttonEmpty.Text = "Empty";
            this.buttonEmpty.UseVisualStyleBackColor = true;
            this.buttonEmpty.Click += new System.EventHandler(this.buttonEmpty_Click);
            // 
            // buttonDefaultOut
            // 
            this.buttonDefaultOut.Anchor = ((System.Windows.Forms.AnchorStyles)((System.Windows.Forms.AnchorStyles.Bottom | System.Windows.Forms.AnchorStyles.Right)));
            this.buttonDefaultOut.Location = new System.Drawing.Point(512, 217);
            this.buttonDefaultOut.Margin = new System.Windows.Forms.Padding(4);
            this.buttonDefaultOut.Name = "buttonDefaultOut";
            this.buttonDefaultOut.Size = new System.Drawing.Size(110, 28);
            this.buttonDefaultOut.TabIndex = 12;
            this.buttonDefaultOut.Text = "Default";
            this.buttonDefaultOut.UseVisualStyleBackColor = true;
            this.buttonDefaultOut.Click += new System.EventHandler(this.buttonDefaultOut_Click);
            // 
            // textOpenCPN
            // 
            this.textOpenCPN.Anchor = ((System.Windows.Forms.AnchorStyles)(((System.Windows.Forms.AnchorStyles.Bottom | System.Windows.Forms.AnchorStyles.Left) 
            | System.Windows.Forms.AnchorStyles.Right)));
            this.textOpenCPN.Location = new System.Drawing.Point(9, 267);
            this.textOpenCPN.Margin = new System.Windows.Forms.Padding(4);
            this.textOpenCPN.Name = "textOpenCPN";
            this.textOpenCPN.Size = new System.Drawing.Size(457, 22);
            this.textOpenCPN.TabIndex = 15;
            // 
            // labelOpenCPN
            // 
            this.labelOpenCPN.Anchor = ((System.Windows.Forms.AnchorStyles)((System.Windows.Forms.AnchorStyles.Bottom | System.Windows.Forms.AnchorStyles.Left)));
            this.labelOpenCPN.AutoSize = true;
            this.labelOpenCPN.Location = new System.Drawing.Point(7, 246);
            this.labelOpenCPN.Margin = new System.Windows.Forms.Padding(4, 0, 4, 0);
            this.labelOpenCPN.Name = "labelOpenCPN";
            this.labelOpenCPN.Size = new System.Drawing.Size(125, 17);
            this.labelOpenCPN.TabIndex = 16;
            this.labelOpenCPN.Text = "OpenCPNLocation";
            // 
            // buttonOpenCPN
            // 
            this.buttonOpenCPN.Anchor = ((System.Windows.Forms.AnchorStyles)((System.Windows.Forms.AnchorStyles.Bottom | System.Windows.Forms.AnchorStyles.Right)));
            this.buttonOpenCPN.AutoSize = true;
            this.buttonOpenCPN.AutoSizeMode = System.Windows.Forms.AutoSizeMode.GrowAndShrink;
            this.buttonOpenCPN.Location = new System.Drawing.Point(474, 265);
            this.buttonOpenCPN.Margin = new System.Windows.Forms.Padding(4);
            this.buttonOpenCPN.Name = "buttonOpenCPN";
            this.buttonOpenCPN.Size = new System.Drawing.Size(30, 27);
            this.buttonOpenCPN.TabIndex = 17;
            this.buttonOpenCPN.Text = "...";
            this.buttonOpenCPN.UseVisualStyleBackColor = true;
            this.buttonOpenCPN.Click += new System.EventHandler(this.buttonOpenCPN_Click);
            // 
            // checkStartServer
            // 
            this.checkStartServer.AutoSize = true;
            this.checkStartServer.Checked = true;
            this.checkStartServer.CheckState = System.Windows.Forms.CheckState.Checked;
            this.checkStartServer.Location = new System.Drawing.Point(14, 58);
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
            this.btnStopServer.Location = new System.Drawing.Point(212, 439);
            this.btnStopServer.Margin = new System.Windows.Forms.Padding(4);
            this.btnStopServer.Name = "btnStopServer";
            this.btnStopServer.Size = new System.Drawing.Size(110, 28);
            this.btnStopServer.TabIndex = 19;
            this.btnStopServer.Text = "StopServer";
            this.btnStopServer.UseVisualStyleBackColor = true;
            this.btnStopServer.Visible = false;
            this.btnStopServer.Click += new System.EventHandler(this.btnStopServer_Click);
            // 
            // btnStartServer
            // 
            this.btnStartServer.Anchor = ((System.Windows.Forms.AnchorStyles)((System.Windows.Forms.AnchorStyles.Top | System.Windows.Forms.AnchorStyles.Right)));
            this.btnStartServer.Location = new System.Drawing.Point(338, 439);
            this.btnStartServer.Margin = new System.Windows.Forms.Padding(4);
            this.btnStartServer.Name = "btnStartServer";
            this.btnStartServer.Size = new System.Drawing.Size(110, 28);
            this.btnStartServer.TabIndex = 20;
            this.btnStartServer.Text = "StartServer";
            this.btnStartServer.UseVisualStyleBackColor = true;
            this.btnStartServer.Click += new System.EventHandler(this.btnStartServer_Click);
            // 
            // lbServerRunning
            // 
            this.lbServerRunning.AutoSize = true;
            this.lbServerRunning.ForeColor = System.Drawing.Color.FromArgb(((int)(((byte)(192)))), ((int)(((byte)(0)))), ((int)(((byte)(0)))));
            this.lbServerRunning.Location = new System.Drawing.Point(169, 59);
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
            this.checkUseCmd.Location = new System.Drawing.Point(9, 297);
            this.checkUseCmd.Margin = new System.Windows.Forms.Padding(4);
            this.checkUseCmd.Name = "checkUseCmd";
            this.checkUseCmd.Size = new System.Drawing.Size(103, 21);
            this.checkUseCmd.TabIndex = 22;
            this.checkUseCmd.Text = "useCmdFile";
            this.checkUseCmd.UseVisualStyleBackColor = true;
            // 
            // lbCmd
            // 
            this.lbCmd.Anchor = ((System.Windows.Forms.AnchorStyles)(((System.Windows.Forms.AnchorStyles.Bottom | System.Windows.Forms.AnchorStyles.Left) 
            | System.Windows.Forms.AnchorStyles.Right)));
            this.lbCmd.AutoSize = true;
            this.lbCmd.Location = new System.Drawing.Point(108, 298);
            this.lbCmd.Margin = new System.Windows.Forms.Padding(4, 0, 4, 0);
            this.lbCmd.Name = "lbCmd";
            this.lbCmd.Size = new System.Drawing.Size(334, 17);
            this.lbCmd.TabIndex = 23;
            this.lbCmd.Text = "check this if python is not found and adapt cmd files";
            // 
            // btTestData
            // 
            this.btTestData.Anchor = ((System.Windows.Forms.AnchorStyles)(((System.Windows.Forms.AnchorStyles.Top | System.Windows.Forms.AnchorStyles.Bottom) 
            | System.Windows.Forms.AnchorStyles.Right)));
            this.btTestData.AutoSize = true;
            this.btTestData.AutoSizeMode = System.Windows.Forms.AutoSizeMode.GrowAndShrink;
            this.btTestData.Location = new System.Drawing.Point(567, 9);
            this.btTestData.Margin = new System.Windows.Forms.Padding(4);
            this.btTestData.Name = "btTestData";
            this.btTestData.Size = new System.Drawing.Size(30, 27);
            this.btTestData.TabIndex = 26;
            this.btTestData.Text = "...";
            this.btTestData.UseVisualStyleBackColor = true;
            this.btTestData.Click += new System.EventHandler(this.btTestData_Click);
            // 
            // txTestData
            // 
            this.txTestData.Anchor = ((System.Windows.Forms.AnchorStyles)(((System.Windows.Forms.AnchorStyles.Top | System.Windows.Forms.AnchorStyles.Left) 
            | System.Windows.Forms.AnchorStyles.Right)));
            this.txTestData.Location = new System.Drawing.Point(146, 12);
            this.txTestData.Margin = new System.Windows.Forms.Padding(4);
            this.txTestData.Name = "txTestData";
            this.txTestData.Size = new System.Drawing.Size(403, 22);
            this.txTestData.TabIndex = 25;
            this.txTestData.TextChanged += new System.EventHandler(this.txTestData_TextChanged);
            // 
            // cbTestData
            // 
            this.cbTestData.AutoSize = true;
            this.cbTestData.Checked = true;
            this.cbTestData.CheckState = System.Windows.Forms.CheckState.Checked;
            this.cbTestData.Location = new System.Drawing.Point(7, 14);
            this.cbTestData.Margin = new System.Windows.Forms.Padding(4);
            this.cbTestData.Name = "cbTestData";
            this.cbTestData.Size = new System.Drawing.Size(83, 21);
            this.cbTestData.TabIndex = 24;
            this.cbTestData.Text = "testData";
            this.cbTestData.UseVisualStyleBackColor = true;
            // 
            // tbUrl
            // 
            this.tbUrl.Anchor = ((System.Windows.Forms.AnchorStyles)(((System.Windows.Forms.AnchorStyles.Top | System.Windows.Forms.AnchorStyles.Left) 
            | System.Windows.Forms.AnchorStyles.Right)));
            this.tbUrl.Location = new System.Drawing.Point(153, 98);
            this.tbUrl.Margin = new System.Windows.Forms.Padding(4);
            this.tbUrl.Name = "tbUrl";
            this.tbUrl.Size = new System.Drawing.Size(403, 22);
            this.tbUrl.TabIndex = 23;
            this.tbUrl.TextChanged += new System.EventHandler(this.tbUrl_TextChanged);
            // 
            // cbBrowser
            // 
            this.cbBrowser.AutoSize = true;
            this.cbBrowser.Checked = true;
            this.cbBrowser.CheckState = System.Windows.Forms.CheckState.Checked;
            this.cbBrowser.Location = new System.Drawing.Point(14, 99);
            this.cbBrowser.Margin = new System.Windows.Forms.Padding(4);
            this.cbBrowser.Name = "cbBrowser";
            this.cbBrowser.Size = new System.Drawing.Size(109, 21);
            this.cbBrowser.TabIndex = 22;
            this.cbBrowser.Text = "startBrowser";
            this.cbBrowser.UseVisualStyleBackColor = true;
            // 
            // splitContainer1
            // 
            this.splitContainer1.Location = new System.Drawing.Point(0, 0);
            this.splitContainer1.Name = "splitContainer1";
            // 
            // splitContainer1.Panel1
            // 
            this.splitContainer1.Panel1.Controls.Add(this.panel1);
            // 
            // splitContainer1.Panel2
            // 
            this.splitContainer1.Panel2.Controls.Add(this.panel2);
            this.splitContainer1.Size = new System.Drawing.Size(1273, 481);
            this.splitContainer1.SplitterDistance = 634;
            this.splitContainer1.TabIndex = 27;
            // 
            // panel1
            // 
            this.panel1.BorderStyle = System.Windows.Forms.BorderStyle.FixedSingle;
            this.panel1.Controls.Add(this.label3);
            this.panel1.Controls.Add(this.labelProcess);
            this.panel1.Controls.Add(this.btLogFile);
            this.panel1.Controls.Add(this.btViewLog);
            this.panel1.Controls.Add(this.cbNewGemf);
            this.panel1.Controls.Add(this.lbCmd);
            this.panel1.Controls.Add(this.tbLogFile);
            this.panel1.Controls.Add(this.cbLogFile);
            this.panel1.Controls.Add(this.checkUseCmd);
            this.panel1.Controls.Add(this.buttonStop);
            this.panel1.Controls.Add(this.buttonOK);
            this.panel1.Controls.Add(this.buttonFocus);
            this.panel1.Controls.Add(this.textIn);
            this.panel1.Controls.Add(this.label1);
            this.panel1.Controls.Add(this.checkBoxUpdate);
            this.panel1.Controls.Add(this.buttonAddDirectories);
            this.panel1.Controls.Add(this.buttonAddFile);
            this.panel1.Controls.Add(this.buttonOpenCPN);
            this.panel1.Controls.Add(this.buttonEmpty);
            this.panel1.Controls.Add(this.textOpenCPN);
            this.panel1.Controls.Add(this.labelOpenCPN);
            this.panel1.Controls.Add(this.label2);
            this.panel1.Controls.Add(this.textOutdir);
            this.panel1.Controls.Add(this.buttonDefaultOut);
            this.panel1.Controls.Add(this.buttonOutDir);
            this.panel1.Dock = System.Windows.Forms.DockStyle.Fill;
            this.panel1.Location = new System.Drawing.Point(0, 0);
            this.panel1.Name = "panel1";
            this.panel1.Padding = new System.Windows.Forms.Padding(5, 0, 0, 0);
            this.panel1.Size = new System.Drawing.Size(634, 481);
            this.panel1.TabIndex = 25;
            // 
            // label3
            // 
            this.label3.AutoSize = true;
            this.label3.Font = new System.Drawing.Font("Microsoft Sans Serif", 12F, System.Drawing.FontStyle.Bold, System.Drawing.GraphicsUnit.Point, ((byte)(0)));
            this.label3.Location = new System.Drawing.Point(249, 8);
            this.label3.Name = "label3";
            this.label3.Size = new System.Drawing.Size(107, 25);
            this.label3.TabIndex = 25;
            this.label3.Text = "Converter";
            // 
            // labelProcess
            // 
            this.labelProcess.Anchor = ((System.Windows.Forms.AnchorStyles)((System.Windows.Forms.AnchorStyles.Bottom | System.Windows.Forms.AnchorStyles.Left)));
            this.labelProcess.AutoSize = true;
            this.labelProcess.Location = new System.Drawing.Point(14, 439);
            this.labelProcess.Name = "labelProcess";
            this.labelProcess.Size = new System.Drawing.Size(89, 17);
            this.labelProcess.TabIndex = 24;
            this.labelProcess.Text = "labelProcess";
            // 
            // btLogFile
            // 
            this.btLogFile.Anchor = ((System.Windows.Forms.AnchorStyles)(((System.Windows.Forms.AnchorStyles.Top | System.Windows.Forms.AnchorStyles.Bottom) 
            | System.Windows.Forms.AnchorStyles.Right)));
            this.btLogFile.AutoSize = true;
            this.btLogFile.AutoSizeMode = System.Windows.Forms.AutoSizeMode.GrowAndShrink;
            this.btLogFile.Location = new System.Drawing.Point(474, 375);
            this.btLogFile.Margin = new System.Windows.Forms.Padding(4);
            this.btLogFile.Name = "btLogFile";
            this.btLogFile.Size = new System.Drawing.Size(30, 27);
            this.btLogFile.TabIndex = 18;
            this.btLogFile.Text = "...";
            this.btLogFile.UseVisualStyleBackColor = true;
            this.btLogFile.Click += new System.EventHandler(this.btLogFile_Click);
            // 
            // btViewLog
            // 
            this.btViewLog.Anchor = ((System.Windows.Forms.AnchorStyles)(((System.Windows.Forms.AnchorStyles.Top | System.Windows.Forms.AnchorStyles.Bottom) 
            | System.Windows.Forms.AnchorStyles.Right)));
            this.btViewLog.Location = new System.Drawing.Point(512, 374);
            this.btViewLog.Margin = new System.Windows.Forms.Padding(4);
            this.btViewLog.Name = "btViewLog";
            this.btViewLog.Size = new System.Drawing.Size(110, 28);
            this.btViewLog.TabIndex = 19;
            this.btViewLog.Text = "View";
            this.btViewLog.UseVisualStyleBackColor = true;
            this.btViewLog.Click += new System.EventHandler(this.btViewLog_Click);
            // 
            // cbNewGemf
            // 
            this.cbNewGemf.Anchor = ((System.Windows.Forms.AnchorStyles)(((System.Windows.Forms.AnchorStyles.Top | System.Windows.Forms.AnchorStyles.Bottom) 
            | System.Windows.Forms.AnchorStyles.Left)));
            this.cbNewGemf.AutoSize = true;
            this.cbNewGemf.Checked = true;
            this.cbNewGemf.CheckState = System.Windows.Forms.CheckState.Checked;
            this.cbNewGemf.Location = new System.Drawing.Point(126, 319);
            this.cbNewGemf.Margin = new System.Windows.Forms.Padding(4);
            this.cbNewGemf.Name = "cbNewGemf";
            this.cbNewGemf.Size = new System.Drawing.Size(89, 21);
            this.cbNewGemf.TabIndex = 20;
            this.cbNewGemf.Text = "newGemf";
            this.cbNewGemf.UseVisualStyleBackColor = true;
            // 
            // tbLogFile
            // 
            this.tbLogFile.Anchor = ((System.Windows.Forms.AnchorStyles)((((System.Windows.Forms.AnchorStyles.Top | System.Windows.Forms.AnchorStyles.Bottom) 
            | System.Windows.Forms.AnchorStyles.Left) 
            | System.Windows.Forms.AnchorStyles.Right)));
            this.tbLogFile.Location = new System.Drawing.Point(9, 377);
            this.tbLogFile.Margin = new System.Windows.Forms.Padding(4);
            this.tbLogFile.Name = "tbLogFile";
            this.tbLogFile.Size = new System.Drawing.Size(457, 22);
            this.tbLogFile.TabIndex = 16;
            // 
            // cbLogFile
            // 
            this.cbLogFile.Anchor = ((System.Windows.Forms.AnchorStyles)(((System.Windows.Forms.AnchorStyles.Top | System.Windows.Forms.AnchorStyles.Bottom) 
            | System.Windows.Forms.AnchorStyles.Left)));
            this.cbLogFile.AutoSize = true;
            this.cbLogFile.Checked = true;
            this.cbLogFile.CheckState = System.Windows.Forms.CheckState.Checked;
            this.cbLogFile.Location = new System.Drawing.Point(9, 348);
            this.cbLogFile.Margin = new System.Windows.Forms.Padding(4);
            this.cbLogFile.Name = "cbLogFile";
            this.cbLogFile.Size = new System.Drawing.Size(71, 21);
            this.cbLogFile.TabIndex = 14;
            this.cbLogFile.Text = "logFile";
            this.cbLogFile.UseVisualStyleBackColor = true;
            // 
            // buttonStop
            // 
            this.buttonStop.Anchor = ((System.Windows.Forms.AnchorStyles)(((System.Windows.Forms.AnchorStyles.Top | System.Windows.Forms.AnchorStyles.Bottom) 
            | System.Windows.Forms.AnchorStyles.Right)));
            this.buttonStop.Location = new System.Drawing.Point(394, 433);
            this.buttonStop.Margin = new System.Windows.Forms.Padding(4);
            this.buttonStop.Name = "buttonStop";
            this.buttonStop.Size = new System.Drawing.Size(110, 28);
            this.buttonStop.TabIndex = 10;
            this.buttonStop.Text = "Stop";
            this.buttonStop.UseVisualStyleBackColor = true;
            this.buttonStop.Visible = false;
            this.buttonStop.Click += new System.EventHandler(this.buttonStop_Click);
            // 
            // buttonOK
            // 
            this.buttonOK.Anchor = ((System.Windows.Forms.AnchorStyles)(((System.Windows.Forms.AnchorStyles.Top | System.Windows.Forms.AnchorStyles.Bottom) 
            | System.Windows.Forms.AnchorStyles.Right)));
            this.buttonOK.Location = new System.Drawing.Point(512, 433);
            this.buttonOK.Margin = new System.Windows.Forms.Padding(4);
            this.buttonOK.Name = "buttonOK";
            this.buttonOK.Size = new System.Drawing.Size(110, 28);
            this.buttonOK.TabIndex = 3;
            this.buttonOK.Text = "Convert";
            this.buttonOK.UseVisualStyleBackColor = true;
            this.buttonOK.Click += new System.EventHandler(this.buttonOK_Click);
            // 
            // buttonFocus
            // 
            this.buttonFocus.Anchor = ((System.Windows.Forms.AnchorStyles)(((System.Windows.Forms.AnchorStyles.Top | System.Windows.Forms.AnchorStyles.Bottom) 
            | System.Windows.Forms.AnchorStyles.Right)));
            this.buttonFocus.Location = new System.Drawing.Point(276, 433);
            this.buttonFocus.Margin = new System.Windows.Forms.Padding(4);
            this.buttonFocus.Name = "buttonFocus";
            this.buttonFocus.Size = new System.Drawing.Size(110, 28);
            this.buttonFocus.TabIndex = 13;
            this.buttonFocus.Text = "Focus";
            this.buttonFocus.UseVisualStyleBackColor = true;
            this.buttonFocus.Visible = false;
            this.buttonFocus.Click += new System.EventHandler(this.buttonFocus_Click);
            // 
            // checkBoxUpdate
            // 
            this.checkBoxUpdate.Anchor = ((System.Windows.Forms.AnchorStyles)(((System.Windows.Forms.AnchorStyles.Top | System.Windows.Forms.AnchorStyles.Bottom) 
            | System.Windows.Forms.AnchorStyles.Left)));
            this.checkBoxUpdate.AutoSize = true;
            this.checkBoxUpdate.Checked = true;
            this.checkBoxUpdate.CheckState = System.Windows.Forms.CheckState.Checked;
            this.checkBoxUpdate.Location = new System.Drawing.Point(9, 319);
            this.checkBoxUpdate.Margin = new System.Windows.Forms.Padding(4);
            this.checkBoxUpdate.Name = "checkBoxUpdate";
            this.checkBoxUpdate.Size = new System.Drawing.Size(109, 21);
            this.checkBoxUpdate.TabIndex = 5;
            this.checkBoxUpdate.Text = "updateMode";
            this.checkBoxUpdate.UseVisualStyleBackColor = true;
            // 
            // panel2
            // 
            this.panel2.BorderStyle = System.Windows.Forms.BorderStyle.FixedSingle;
            this.panel2.Controls.Add(this.pUserConfig);
            this.panel2.Controls.Add(this.pServerMode);
            this.panel2.Controls.Add(this.pIp);
            this.panel2.Controls.Add(this.pCom);
            this.panel2.Controls.Add(this.pTestData);
            this.panel2.Controls.Add(this.label5);
            this.panel2.Controls.Add(this.label4);
            this.panel2.Controls.Add(this.checkStartServer);
            this.panel2.Controls.Add(this.lbServerRunning);
            this.panel2.Controls.Add(this.btnStopServer);
            this.panel2.Controls.Add(this.cbBrowser);
            this.panel2.Controls.Add(this.tbUrl);
            this.panel2.Controls.Add(this.btnStartServer);
            this.panel2.Dock = System.Windows.Forms.DockStyle.Fill;
            this.panel2.Location = new System.Drawing.Point(0, 0);
            this.panel2.Name = "panel2";
            this.panel2.Size = new System.Drawing.Size(635, 481);
            this.panel2.TabIndex = 27;
            // 
            // pUserConfig
            // 
            this.pUserConfig.Controls.Add(this.btEditUserConfig);
            this.pUserConfig.Controls.Add(this.label9);
            this.pUserConfig.Controls.Add(this.btChangeUserConfig);
            this.pUserConfig.Controls.Add(this.txUserConfig);
            this.pUserConfig.Location = new System.Drawing.Point(6, 211);
            this.pUserConfig.Name = "pUserConfig";
            this.pUserConfig.Size = new System.Drawing.Size(594, 38);
            this.pUserConfig.TabIndex = 46;
            this.pUserConfig.Visible = false;
            // 
            // btEditUserConfig
            // 
            this.btEditUserConfig.Anchor = ((System.Windows.Forms.AnchorStyles)((System.Windows.Forms.AnchorStyles.Top | System.Windows.Forms.AnchorStyles.Right)));
            this.btEditUserConfig.Location = new System.Drawing.Point(468, 3);
            this.btEditUserConfig.Margin = new System.Windows.Forms.Padding(4);
            this.btEditUserConfig.Name = "btEditUserConfig";
            this.btEditUserConfig.Size = new System.Drawing.Size(110, 28);
            this.btEditUserConfig.TabIndex = 45;
            this.btEditUserConfig.Text = "Edit";
            this.btEditUserConfig.UseVisualStyleBackColor = true;
            this.btEditUserConfig.Click += new System.EventHandler(this.btEditUserConfig_Click);
            // 
            // label9
            // 
            this.label9.AutoSize = true;
            this.label9.Location = new System.Drawing.Point(10, 11);
            this.label9.Name = "label9";
            this.label9.Size = new System.Drawing.Size(80, 17);
            this.label9.TabIndex = 44;
            this.label9.Text = "User config";
            // 
            // btChangeUserConfig
            // 
            this.btChangeUserConfig.Anchor = ((System.Windows.Forms.AnchorStyles)(((System.Windows.Forms.AnchorStyles.Top | System.Windows.Forms.AnchorStyles.Bottom) 
            | System.Windows.Forms.AnchorStyles.Right)));
            this.btChangeUserConfig.AutoSize = true;
            this.btChangeUserConfig.AutoSizeMode = System.Windows.Forms.AutoSizeMode.GrowAndShrink;
            this.btChangeUserConfig.Location = new System.Drawing.Point(430, 5);
            this.btChangeUserConfig.Margin = new System.Windows.Forms.Padding(4);
            this.btChangeUserConfig.Name = "btChangeUserConfig";
            this.btChangeUserConfig.Size = new System.Drawing.Size(30, 27);
            this.btChangeUserConfig.TabIndex = 43;
            this.btChangeUserConfig.Text = "...";
            this.btChangeUserConfig.UseVisualStyleBackColor = true;
            this.btChangeUserConfig.Click += new System.EventHandler(this.btChangeUserConfig_Click);
            // 
            // txUserConfig
            // 
            this.txUserConfig.Anchor = ((System.Windows.Forms.AnchorStyles)(((System.Windows.Forms.AnchorStyles.Top | System.Windows.Forms.AnchorStyles.Left) 
            | System.Windows.Forms.AnchorStyles.Right)));
            this.txUserConfig.Location = new System.Drawing.Point(127, 8);
            this.txUserConfig.Margin = new System.Windows.Forms.Padding(4);
            this.txUserConfig.Name = "txUserConfig";
            this.txUserConfig.Size = new System.Drawing.Size(295, 22);
            this.txUserConfig.TabIndex = 42;
            this.txUserConfig.TextChanged += new System.EventHandler(this.txUserConfig_TextChanged);
            // 
            // pServerMode
            // 
            this.pServerMode.Controls.Add(this.rbModeCustom);
            this.pServerMode.Controls.Add(this.rbModeTest);
            this.pServerMode.Controls.Add(this.rbModeIP);
            this.pServerMode.Controls.Add(this.rbModeCom);
            this.pServerMode.Location = new System.Drawing.Point(142, 146);
            this.pServerMode.Name = "pServerMode";
            this.pServerMode.Size = new System.Drawing.Size(360, 47);
            this.pServerMode.TabIndex = 42;
            // 
            // rbModeCustom
            // 
            this.rbModeCustom.AutoSize = true;
            this.rbModeCustom.Location = new System.Drawing.Point(265, 9);
            this.rbModeCustom.Name = "rbModeCustom";
            this.rbModeCustom.Size = new System.Drawing.Size(76, 21);
            this.rbModeCustom.TabIndex = 31;
            this.rbModeCustom.TabStop = true;
            this.rbModeCustom.Text = "Custom";
            this.rbModeCustom.UseVisualStyleBackColor = true;
            this.rbModeCustom.CheckedChanged += new System.EventHandler(this.rbModeCustom_CheckedChanged);
            // 
            // rbModeTest
            // 
            this.rbModeTest.AutoSize = true;
            this.rbModeTest.Location = new System.Drawing.Point(11, 9);
            this.rbModeTest.Name = "rbModeTest";
            this.rbModeTest.Size = new System.Drawing.Size(57, 21);
            this.rbModeTest.TabIndex = 30;
            this.rbModeTest.TabStop = true;
            this.rbModeTest.Text = "Test";
            this.rbModeTest.UseVisualStyleBackColor = true;
            this.rbModeTest.CheckedChanged += new System.EventHandler(this.rbModeTest_CheckedChanged);
            // 
            // rbModeIP
            // 
            this.rbModeIP.AutoSize = true;
            this.rbModeIP.Location = new System.Drawing.Point(178, 9);
            this.rbModeIP.Name = "rbModeIP";
            this.rbModeIP.Size = new System.Drawing.Size(41, 21);
            this.rbModeIP.TabIndex = 29;
            this.rbModeIP.TabStop = true;
            this.rbModeIP.Text = "IP";
            this.rbModeIP.UseVisualStyleBackColor = true;
            this.rbModeIP.CheckedChanged += new System.EventHandler(this.rbModeIP_CheckedChanged);
            // 
            // rbModeCom
            // 
            this.rbModeCom.AutoSize = true;
            this.rbModeCom.Location = new System.Drawing.Point(83, 9);
            this.rbModeCom.Name = "rbModeCom";
            this.rbModeCom.Size = new System.Drawing.Size(89, 21);
            this.rbModeCom.TabIndex = 28;
            this.rbModeCom.TabStop = true;
            this.rbModeCom.Text = "COM port";
            this.rbModeCom.UseVisualStyleBackColor = true;
            this.rbModeCom.CheckedChanged += new System.EventHandler(this.rbModeCom_CheckedChanged);
            // 
            // pIp
            // 
            this.pIp.Controls.Add(this.label8);
            this.pIp.Controls.Add(this.txIpPort);
            this.pIp.Controls.Add(this.label7);
            this.pIp.Controls.Add(this.txIpAddress);
            this.pIp.Location = new System.Drawing.Point(6, 211);
            this.pIp.Name = "pIp";
            this.pIp.Size = new System.Drawing.Size(545, 35);
            this.pIp.TabIndex = 40;
            this.pIp.Visible = false;
            // 
            // label8
            // 
            this.label8.AutoSize = true;
            this.label8.Location = new System.Drawing.Point(340, 9);
            this.label8.Name = "label8";
            this.label8.Size = new System.Drawing.Size(49, 17);
            this.label8.TabIndex = 39;
            this.label8.Text = "IP port";
            // 
            // txIpPort
            // 
            this.txIpPort.Anchor = ((System.Windows.Forms.AnchorStyles)(((System.Windows.Forms.AnchorStyles.Top | System.Windows.Forms.AnchorStyles.Left) 
            | System.Windows.Forms.AnchorStyles.Right)));
            this.txIpPort.Location = new System.Drawing.Point(423, 6);
            this.txIpPort.Margin = new System.Windows.Forms.Padding(4);
            this.txIpPort.Name = "txIpPort";
            this.txIpPort.Size = new System.Drawing.Size(104, 22);
            this.txIpPort.TabIndex = 38;
            this.txIpPort.TextChanged += new System.EventHandler(this.txIpPort_TextChanged);
            // 
            // label7
            // 
            this.label7.AutoSize = true;
            this.label7.Location = new System.Drawing.Point(7, 9);
            this.label7.Name = "label7";
            this.label7.Size = new System.Drawing.Size(75, 17);
            this.label7.TabIndex = 37;
            this.label7.Text = "IP address";
            // 
            // txIpAddress
            // 
            this.txIpAddress.Anchor = ((System.Windows.Forms.AnchorStyles)(((System.Windows.Forms.AnchorStyles.Top | System.Windows.Forms.AnchorStyles.Left) 
            | System.Windows.Forms.AnchorStyles.Right)));
            this.txIpAddress.Location = new System.Drawing.Point(124, 6);
            this.txIpAddress.Margin = new System.Windows.Forms.Padding(4);
            this.txIpAddress.Name = "txIpAddress";
            this.txIpAddress.Size = new System.Drawing.Size(131, 22);
            this.txIpAddress.TabIndex = 36;
            this.txIpAddress.TextChanged += new System.EventHandler(this.txIpAddress_TextChanged);
            // 
            // pCom
            // 
            this.pCom.Controls.Add(this.btRefreshCom);
            this.pCom.Controls.Add(this.label6);
            this.pCom.Controls.Add(this.lbComPort);
            this.pCom.Location = new System.Drawing.Point(6, 211);
            this.pCom.Name = "pCom";
            this.pCom.Size = new System.Drawing.Size(597, 37);
            this.pCom.TabIndex = 35;
            this.pCom.Visible = false;
            // 
            // btRefreshCom
            // 
            this.btRefreshCom.Anchor = ((System.Windows.Forms.AnchorStyles)((System.Windows.Forms.AnchorStyles.Top | System.Windows.Forms.AnchorStyles.Right)));
            this.btRefreshCom.Location = new System.Drawing.Point(265, -1);
            this.btRefreshCom.Margin = new System.Windows.Forms.Padding(4);
            this.btRefreshCom.Name = "btRefreshCom";
            this.btRefreshCom.Size = new System.Drawing.Size(110, 28);
            this.btRefreshCom.TabIndex = 46;
            this.btRefreshCom.Text = "Refresh";
            this.btRefreshCom.UseVisualStyleBackColor = true;
            this.btRefreshCom.Click += new System.EventHandler(this.btRefreshCom_Click);
            // 
            // label6
            // 
            this.label6.AutoSize = true;
            this.label6.Location = new System.Drawing.Point(8, 4);
            this.label6.Name = "label6";
            this.label6.Size = new System.Drawing.Size(69, 17);
            this.label6.TabIndex = 34;
            this.label6.Text = "COM Port";
            // 
            // lbComPort
            // 
            this.lbComPort.FormattingEnabled = true;
            this.lbComPort.ItemHeight = 16;
            this.lbComPort.Location = new System.Drawing.Point(127, 4);
            this.lbComPort.Name = "lbComPort";
            this.lbComPort.Size = new System.Drawing.Size(131, 20);
            this.lbComPort.TabIndex = 33;
            this.lbComPort.SelectedIndexChanged += new System.EventHandler(this.lbComPort_SelectedIndexChanged);
            // 
            // pTestData
            // 
            this.pTestData.Controls.Add(this.btTestData);
            this.pTestData.Controls.Add(this.txTestData);
            this.pTestData.Controls.Add(this.cbTestData);
            this.pTestData.Location = new System.Drawing.Point(6, 211);
            this.pTestData.Name = "pTestData";
            this.pTestData.Size = new System.Drawing.Size(614, 51);
            this.pTestData.TabIndex = 41;
            this.pTestData.Visible = false;
            // 
            // label5
            // 
            this.label5.AutoSize = true;
            this.label5.Location = new System.Drawing.Point(11, 157);
            this.label5.Name = "label5";
            this.label5.Size = new System.Drawing.Size(94, 17);
            this.label5.TabIndex = 32;
            this.label5.Text = "Server Config";
            // 
            // label4
            // 
            this.label4.AutoSize = true;
            this.label4.Font = new System.Drawing.Font("Microsoft Sans Serif", 12F, System.Drawing.FontStyle.Bold, System.Drawing.GraphicsUnit.Point, ((byte)(0)));
            this.label4.Location = new System.Drawing.Point(246, 8);
            this.label4.Name = "label4";
            this.label4.Size = new System.Drawing.Size(76, 25);
            this.label4.TabIndex = 27;
            this.label4.Text = "Server";
            // 
            // Form1
            // 
            this.AutoScaleDimensions = new System.Drawing.SizeF(8F, 16F);
            this.AutoScaleMode = System.Windows.Forms.AutoScaleMode.Font;
            this.ClientSize = new System.Drawing.Size(1271, 553);
            this.Controls.Add(this.splitContainer1);
            this.Controls.Add(this.buttonCancel);
            this.Icon = ((System.Drawing.Icon)(resources.GetObject("$this.Icon")));
            this.Margin = new System.Windows.Forms.Padding(4);
            this.MinimumSize = new System.Drawing.Size(655, 600);
            this.Name = "Form1";
            this.Text = "AvChartConvert";
            this.FormClosing += new System.Windows.Forms.FormClosingEventHandler(this.Form1_FormClosing);
            this.splitContainer1.Panel1.ResumeLayout(false);
            this.splitContainer1.Panel2.ResumeLayout(false);
            ((System.ComponentModel.ISupportInitialize)(this.splitContainer1)).EndInit();
            this.splitContainer1.ResumeLayout(false);
            this.panel1.ResumeLayout(false);
            this.panel1.PerformLayout();
            this.panel2.ResumeLayout(false);
            this.panel2.PerformLayout();
            this.pUserConfig.ResumeLayout(false);
            this.pUserConfig.PerformLayout();
            this.pServerMode.ResumeLayout(false);
            this.pServerMode.PerformLayout();
            this.pIp.ResumeLayout(false);
            this.pIp.PerformLayout();
            this.pCom.ResumeLayout(false);
            this.pCom.PerformLayout();
            this.pTestData.ResumeLayout(false);
            this.pTestData.PerformLayout();
            this.ResumeLayout(false);

        }

        #endregion

        private System.Windows.Forms.TextBox textIn;
        private System.Windows.Forms.Label label1;
        private System.Windows.Forms.OpenFileDialog openInputDialog;
        private System.Windows.Forms.Button buttonAddFile;
        private System.Windows.Forms.Button buttonCancel;
        private System.Windows.Forms.TextBox textOutdir;
        private System.Windows.Forms.Label label2;
        private System.Windows.Forms.Button buttonOutDir;
        private System.Windows.Forms.FolderBrowserDialog folderBrowserInput;
        private System.Windows.Forms.Button buttonAddDirectories;
        private System.Windows.Forms.FolderBrowserDialog folderBrowserOutput;
        private System.Windows.Forms.Timer timer1;
        private System.Windows.Forms.Button buttonEmpty;
        private System.Windows.Forms.Button buttonDefaultOut;
        private System.Windows.Forms.TextBox textOpenCPN;
        private System.Windows.Forms.Label labelOpenCPN;
        private System.Windows.Forms.Button buttonOpenCPN;
        private System.Windows.Forms.CheckBox checkStartServer;
        private System.Windows.Forms.Button btnStopServer;
        private System.Windows.Forms.Button btnStartServer;
        private System.Windows.Forms.Label lbServerRunning;
        private System.Windows.Forms.Timer timer2;
        private System.Windows.Forms.CheckBox checkUseCmd;
        private System.Windows.Forms.Label lbCmd;
        private System.Windows.Forms.SaveFileDialog openOutputDialog;
        private System.Windows.Forms.CheckBox cbBrowser;
        private System.Windows.Forms.TextBox tbUrl;
        private System.Windows.Forms.Button btTestData;
        private System.Windows.Forms.TextBox txTestData;
        private System.Windows.Forms.CheckBox cbTestData;
        private System.Windows.Forms.SplitContainer splitContainer1;
        private System.Windows.Forms.Button btLogFile;
        private System.Windows.Forms.Button btViewLog;
        private System.Windows.Forms.CheckBox cbNewGemf;
        private System.Windows.Forms.TextBox tbLogFile;
        private System.Windows.Forms.CheckBox cbLogFile;
        private System.Windows.Forms.Button buttonStop;
        private System.Windows.Forms.Button buttonOK;
        private System.Windows.Forms.Button buttonFocus;
        private System.Windows.Forms.CheckBox checkBoxUpdate;
        private System.Windows.Forms.Label labelProcess;
        private System.Windows.Forms.Panel panel1;
        private System.Windows.Forms.Panel panel2;
        private System.Windows.Forms.Label label3;
        private System.Windows.Forms.Label label4;
        private System.Windows.Forms.RadioButton rbModeIP;
        private System.Windows.Forms.RadioButton rbModeCom;
        private System.Windows.Forms.Panel pServerMode;
        private System.Windows.Forms.RadioButton rbModeCustom;
        private System.Windows.Forms.RadioButton rbModeTest;
        private System.Windows.Forms.Panel pTestData;
        private System.Windows.Forms.Panel pUserConfig;
        private System.Windows.Forms.Button btEditUserConfig;
        private System.Windows.Forms.Label label9;
        private System.Windows.Forms.Button btChangeUserConfig;
        private System.Windows.Forms.TextBox txUserConfig;
        private System.Windows.Forms.Panel pIp;
        private System.Windows.Forms.Label label8;
        private System.Windows.Forms.TextBox txIpPort;
        private System.Windows.Forms.Label label7;
        private System.Windows.Forms.TextBox txIpAddress;
        private System.Windows.Forms.Panel pCom;
        private System.Windows.Forms.Label label6;
        private System.Windows.Forms.ListBox lbComPort;
        private System.Windows.Forms.Label label5;
        private System.Windows.Forms.Button btRefreshCom;
    }
}

