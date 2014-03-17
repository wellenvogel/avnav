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
            this.SuspendLayout();
            // 
            // textIn
            // 
            this.textIn.Location = new System.Drawing.Point(12, 36);
            this.textIn.Multiline = true;
            this.textIn.Name = "textIn";
            this.textIn.Size = new System.Drawing.Size(493, 321);
            this.textIn.TabIndex = 0;
            // 
            // label1
            // 
            this.label1.AutoSize = true;
            this.label1.Location = new System.Drawing.Point(12, 9);
            this.label1.Name = "label1";
            this.label1.Size = new System.Drawing.Size(52, 13);
            this.label1.TabIndex = 1;
            this.label1.Text = "InputFiles";
            // 
            // openInputDialog
            // 
            this.openInputDialog.FileName = "openFileDialog1";
            // 
            // buttonAddFile
            // 
            this.buttonAddFile.Location = new System.Drawing.Point(529, 63);
            this.buttonAddFile.Name = "buttonAddFile";
            this.buttonAddFile.Size = new System.Drawing.Size(94, 23);
            this.buttonAddFile.TabIndex = 2;
            this.buttonAddFile.Text = "AddFile(s)";
            this.buttonAddFile.UseVisualStyleBackColor = true;
            this.buttonAddFile.Click += new System.EventHandler(this.buttonAddFile_Click);
            // 
            // buttonOK
            // 
            this.buttonOK.Location = new System.Drawing.Point(333, 550);
            this.buttonOK.Name = "buttonOK";
            this.buttonOK.Size = new System.Drawing.Size(75, 23);
            this.buttonOK.TabIndex = 3;
            this.buttonOK.Text = "Start";
            this.buttonOK.UseVisualStyleBackColor = true;
            this.buttonOK.Click += new System.EventHandler(this.buttonOK_Click);
            // 
            // buttonCancel
            // 
            this.buttonCancel.Location = new System.Drawing.Point(239, 550);
            this.buttonCancel.Name = "buttonCancel";
            this.buttonCancel.Size = new System.Drawing.Size(75, 23);
            this.buttonCancel.TabIndex = 4;
            this.buttonCancel.Text = "Exit";
            this.buttonCancel.UseVisualStyleBackColor = true;
            this.buttonCancel.Click += new System.EventHandler(this.buttonCancel_Click);
            // 
            // checkBoxUpdate
            // 
            this.checkBoxUpdate.AutoSize = true;
            this.checkBoxUpdate.Checked = true;
            this.checkBoxUpdate.CheckState = System.Windows.Forms.CheckState.Checked;
            this.checkBoxUpdate.Location = new System.Drawing.Point(15, 474);
            this.checkBoxUpdate.Name = "checkBoxUpdate";
            this.checkBoxUpdate.Size = new System.Drawing.Size(86, 17);
            this.checkBoxUpdate.TabIndex = 5;
            this.checkBoxUpdate.Text = "updateMode";
            this.checkBoxUpdate.UseVisualStyleBackColor = true;
            // 
            // textOutdir
            // 
            this.textOutdir.Location = new System.Drawing.Point(12, 389);
            this.textOutdir.Name = "textOutdir";
            this.textOutdir.Size = new System.Drawing.Size(493, 20);
            this.textOutdir.TabIndex = 6;
            this.textOutdir.TextChanged += new System.EventHandler(this.textOutdir_TextChanged);
            // 
            // label2
            // 
            this.label2.AutoSize = true;
            this.label2.Location = new System.Drawing.Point(12, 373);
            this.label2.Name = "label2";
            this.label2.Size = new System.Drawing.Size(52, 13);
            this.label2.TabIndex = 7;
            this.label2.Text = "OutputDir";
            // 
            // buttonOutDir
            // 
            this.buttonOutDir.Location = new System.Drawing.Point(511, 389);
            this.buttonOutDir.Name = "buttonOutDir";
            this.buttonOutDir.Size = new System.Drawing.Size(54, 23);
            this.buttonOutDir.TabIndex = 8;
            this.buttonOutDir.Text = "Change";
            this.buttonOutDir.UseVisualStyleBackColor = true;
            this.buttonOutDir.Click += new System.EventHandler(this.buttonOutDir_Click);
            // 
            // buttonAddDirectories
            // 
            this.buttonAddDirectories.Location = new System.Drawing.Point(529, 34);
            this.buttonAddDirectories.Name = "buttonAddDirectories";
            this.buttonAddDirectories.Size = new System.Drawing.Size(94, 23);
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
            this.buttonStop.Location = new System.Drawing.Point(452, 470);
            this.buttonStop.Name = "buttonStop";
            this.buttonStop.Size = new System.Drawing.Size(75, 23);
            this.buttonStop.TabIndex = 10;
            this.buttonStop.Text = "Stop";
            this.buttonStop.UseVisualStyleBackColor = true;
            this.buttonStop.Visible = false;
            this.buttonStop.Click += new System.EventHandler(this.buttonStop_Click);
            // 
            // buttonEmpty
            // 
            this.buttonEmpty.Location = new System.Drawing.Point(529, 130);
            this.buttonEmpty.Name = "buttonEmpty";
            this.buttonEmpty.Size = new System.Drawing.Size(94, 24);
            this.buttonEmpty.TabIndex = 11;
            this.buttonEmpty.Text = "Empty";
            this.buttonEmpty.UseVisualStyleBackColor = true;
            this.buttonEmpty.Click += new System.EventHandler(this.buttonEmpty_Click);
            // 
            // buttonDefaultOut
            // 
            this.buttonDefaultOut.Location = new System.Drawing.Point(571, 389);
            this.buttonDefaultOut.Name = "buttonDefaultOut";
            this.buttonDefaultOut.Size = new System.Drawing.Size(52, 23);
            this.buttonDefaultOut.TabIndex = 12;
            this.buttonDefaultOut.Text = "Default";
            this.buttonDefaultOut.UseVisualStyleBackColor = true;
            this.buttonDefaultOut.Click += new System.EventHandler(this.buttonDefaultOut_Click);
            // 
            // buttonFocus
            // 
            this.buttonFocus.Location = new System.Drawing.Point(548, 470);
            this.buttonFocus.Name = "buttonFocus";
            this.buttonFocus.Size = new System.Drawing.Size(75, 23);
            this.buttonFocus.TabIndex = 13;
            this.buttonFocus.Text = "Focus";
            this.buttonFocus.UseVisualStyleBackColor = true;
            this.buttonFocus.Visible = false;
            this.buttonFocus.Click += new System.EventHandler(this.buttonFocus_Click);
            // 
            // labelProcess
            // 
            this.labelProcess.Location = new System.Drawing.Point(209, 475);
            this.labelProcess.Name = "labelProcess";
            this.labelProcess.Size = new System.Drawing.Size(103, 21);
            this.labelProcess.TabIndex = 14;
            // 
            // textOpenCPN
            // 
            this.textOpenCPN.Location = new System.Drawing.Point(12, 432);
            this.textOpenCPN.Name = "textOpenCPN";
            this.textOpenCPN.Size = new System.Drawing.Size(493, 20);
            this.textOpenCPN.TabIndex = 15;
            // 
            // labelOpenCPN
            // 
            this.labelOpenCPN.AutoSize = true;
            this.labelOpenCPN.Location = new System.Drawing.Point(12, 416);
            this.labelOpenCPN.Name = "labelOpenCPN";
            this.labelOpenCPN.Size = new System.Drawing.Size(96, 13);
            this.labelOpenCPN.TabIndex = 16;
            this.labelOpenCPN.Text = "OpenCPNLocation";
            // 
            // buttonOpenCPN
            // 
            this.buttonOpenCPN.Location = new System.Drawing.Point(511, 430);
            this.buttonOpenCPN.Name = "buttonOpenCPN";
            this.buttonOpenCPN.Size = new System.Drawing.Size(54, 23);
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
            this.checkStartServer.Location = new System.Drawing.Point(15, 508);
            this.checkStartServer.Name = "checkStartServer";
            this.checkStartServer.Size = new System.Drawing.Size(100, 17);
            this.checkStartServer.TabIndex = 18;
            this.checkStartServer.Text = "autoStartServer";
            this.checkStartServer.UseVisualStyleBackColor = true;
            // 
            // btnStopServer
            // 
            this.btnStopServer.Location = new System.Drawing.Point(452, 504);
            this.btnStopServer.Name = "btnStopServer";
            this.btnStopServer.Size = new System.Drawing.Size(75, 23);
            this.btnStopServer.TabIndex = 19;
            this.btnStopServer.Text = "StopServer";
            this.btnStopServer.UseVisualStyleBackColor = true;
            this.btnStopServer.Visible = false;
            this.btnStopServer.Click += new System.EventHandler(this.btnStopServer_Click);
            // 
            // btnStartServer
            // 
            this.btnStartServer.Location = new System.Drawing.Point(548, 505);
            this.btnStartServer.Name = "btnStartServer";
            this.btnStartServer.Size = new System.Drawing.Size(75, 23);
            this.btnStartServer.TabIndex = 20;
            this.btnStartServer.Text = "StartServer";
            this.btnStartServer.UseVisualStyleBackColor = true;
            this.btnStartServer.Click += new System.EventHandler(this.btnStartServer_Click);
            // 
            // lbServerRunning
            // 
            this.lbServerRunning.AutoSize = true;
            this.lbServerRunning.ForeColor = System.Drawing.Color.FromArgb(((int)(((byte)(192)))), ((int)(((byte)(0)))), ((int)(((byte)(0)))));
            this.lbServerRunning.Location = new System.Drawing.Point(209, 509);
            this.lbServerRunning.Name = "lbServerRunning";
            this.lbServerRunning.Size = new System.Drawing.Size(79, 13);
            this.lbServerRunning.TabIndex = 21;
            this.lbServerRunning.Text = "Server stopped";
            // 
            // timer2
            // 
            this.timer2.Enabled = true;
            this.timer2.Interval = 500;
            this.timer2.Tick += new System.EventHandler(this.timer2_Tick);
            // 
            // Form1
            // 
            this.AutoScaleDimensions = new System.Drawing.SizeF(6F, 13F);
            this.AutoScaleMode = System.Windows.Forms.AutoScaleMode.Font;
            this.ClientSize = new System.Drawing.Size(635, 607);
            this.Controls.Add(this.lbServerRunning);
            this.Controls.Add(this.btnStartServer);
            this.Controls.Add(this.btnStopServer);
            this.Controls.Add(this.checkStartServer);
            this.Controls.Add(this.buttonOpenCPN);
            this.Controls.Add(this.labelOpenCPN);
            this.Controls.Add(this.textOpenCPN);
            this.Controls.Add(this.labelProcess);
            this.Controls.Add(this.buttonFocus);
            this.Controls.Add(this.buttonDefaultOut);
            this.Controls.Add(this.buttonEmpty);
            this.Controls.Add(this.buttonStop);
            this.Controls.Add(this.buttonAddDirectories);
            this.Controls.Add(this.buttonOutDir);
            this.Controls.Add(this.label2);
            this.Controls.Add(this.textOutdir);
            this.Controls.Add(this.checkBoxUpdate);
            this.Controls.Add(this.buttonCancel);
            this.Controls.Add(this.buttonOK);
            this.Controls.Add(this.buttonAddFile);
            this.Controls.Add(this.label1);
            this.Controls.Add(this.textIn);
            this.Icon = ((System.Drawing.Icon)(resources.GetObject("$this.Icon")));
            this.Name = "Form1";
            this.Text = "AvChartConvert";
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
    }
}

