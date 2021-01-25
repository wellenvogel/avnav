/*##############################################################################
# Copyright (c) 2012,2013,2014 Andreas Vogel andreas@wellenvogel.net
#
#  Permission is hereby granted, free of charge, to any person obtaining a
#  copy of this software and associated documentation files (the "Software"),
#  to deal in the Software without restriction, including without limitation
#  the rights to use, copy, modify, merge, publish, distribute, sublicense,
#  and/or sell copies of the Software, and to permit persons to whom the
#  Software is furnished to do so, subject to the following conditions:
#
#  The above copyright notice and this permission notice shall be included
#  in all copies or substantial portions of the Software.
#
#  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
#  OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
#  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL
#  THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
#  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
#  FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
#  DEALINGS IN THE SOFTWARE.
#
###############################################################################*/


using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Data;
using System.Drawing;
using System.Linq;
using System.Text;
using System.Windows.Forms;
using System.Diagnostics;
using System.Management;
using System.IO;
using System.IO.Ports;
using System.Runtime.InteropServices;
using System.Globalization;
using System.Text.RegularExpressions;
using System.Collections;
using System.Collections.Specialized;

namespace AvChartConvert
{


    public partial class Form1 : Form
    {
        [DllImport("user32.dll")]
        static extern bool SetForegroundWindow(IntPtr hWnd);
        const String BASE = "AvNavCharts";
        string defaultOut = null;
        Process converter = null;
        string lastdir = (string)Properties.Settings.Default["InputDir"];
        string assemblyPath = System.IO.Path.GetDirectoryName(
          System.Reflection.Assembly.GetExecutingAssembly().GetName().CodeBase).Replace("file:\\", "");
#if AVNAV_NET
        string myPath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "avnav");
        bool canUpdate = true;
#else
        string myPath = null;
        bool canUpdate=false;
       
#endif
        bool initialDownloadTried = false;
        string serverconfigtemplate;
        string scriptpath;
        string serverpath;
        string viewerpath;
        string testdir;
        string servermode = "test";
        Process serverProcess = null;
        bool enableDoneAction = false;
        SocketServer server = null;
        string serverconfig;
        string defaultuserconfig;
        ProcessLog logDisplay;
        private ProcessStartInfo getPythonCommandPath(string command)
        {
#if AVNAV_NET
            string python = Path.Combine(myPath, "python", "python.exe");
            ProcessStartInfo info = new ProcessStartInfo(python, "\"" + command + "\"");
            string gdalpath = Path.Combine(myPath, "gdal", "PFiles", "GDAL");
            string gdaldata = Path.Combine(gdalpath, "gdal-data");
            string gdalpython = Path.Combine(myPath, "gdal", "Lib", "site-packages");
            StringDictionary environment = info.EnvironmentVariables;
            if (environment.ContainsKey("GDAL_DATA")){
                environment.Remove("GDAL_DATA");
            }
            environment.Add("GDAL_DATA", gdaldata);
            if (environment.ContainsKey("PYTHONPATH")){
                environment.Remove("PYTHONPATH");
            }
            environment.Add("PYTHONPATH", gdalpython);
            environment["PATH"] = environment["PATH"] + ";" + gdalpath;
            return info;
#else
            string python = Path.Combine(myPath, "python", "python.exe");
            ProcessStartInfo info = new ProcessStartInfo(python, "\"" + command + "\"");
            return info;

#endif

        }
        public Form1()
        {
            if (myPath == null) myPath = assemblyPath;
            InitializeComponent();
            if (!canUpdate)
            {
                updateButton.Visible = false;
                buttonRemove.Visible = false;
            }
            defaultOut = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile) + "\\" + BASE;
            scriptpath = Path.Combine(myPath, "chartconvert");
            serverpath = Path.Combine(myPath, "server");
            testdir = Path.Combine(myPath, "test");
            viewerpath = Path.Combine(myPath, "viewer");
            string outdir = (string)Properties.Settings.Default["OutDir"];
            if (outdir == null || outdir == "") outdir = defaultOut;
            this.textOutdir.Text = outdir;
            string testdata = (string)Properties.Settings.Default["TestData"];
            if (testdata == null || testdata == "") testdata = Path.Combine(testdir, "nmea-20130630-3.log");
            this.txTestData.Text = testdata;
            string logfile = (string)Properties.Settings.Default["LogFile"];
            if (logfile == null || logfile == "") logfile = Path.Combine(outdir, "avnav-chartconvert.log");
            this.tbLogFile.Text = logfile;
            this.tbUrl.Text = (string)Properties.Settings.Default["LocalUrl"];
            if (tbUrl.Text == "") tbUrl.Text = "http://localhost:8080";
            this.textIn.Clear();
            string[] args = Environment.GetCommandLineArgs();
            if (args.Length > 1)
            {
                for (int i = 1; i < args.Length; i++)
                {
                    this.textIn.AppendText(args[i] + "\n");
                }
                this.buttonOK_Click(null, null);
            }
            serverconfig = Path.Combine(outdir, "avnav_server_tmp.xml");
            defaultuserconfig = Path.Combine(outdir, "avnav_server_user.xml");
            serverconfigtemplate = Path.Combine(myPath, "windows", "avnav_server.xml");
            servermode = (string)Properties.Settings.Default["ServerMode"];
            if (servermode == null || servermode == "") servermode = "test";
            if (servermode != "com" && servermode != "ip" && servermode != "custom") rbModeTest.Checked = true;
            if (servermode == "com") rbModeCom.Checked = true;
            if (servermode == "ip") rbModeIP.Checked = true;
            if (servermode == "custom") rbModeCustom.Checked = true;
            txIpAddress.Text = (string)Properties.Settings.Default["IPAddress"];
            txIpPort.Text = (string)Properties.Settings.Default["IPPort"];
            txUserConfig.Text = (string)Properties.Settings.Default["UserConfig"];
            if (txUserConfig.Text == "") txUserConfig.Text = defaultuserconfig;
            handleServerModeChange();
            fillComPorts();
            int testPort = 34568;
            try
            {
                testPort = (int)Properties.Settings.Default["TestPort"];
            }
            catch (Exception e) { }
            if (testPort <= 0) testPort = 34568;
            txTestPort.Text = string.Format("{0}", testPort);
            txTestDelay.Text = (string)Properties.Settings.Default["TestDelay"];
            if (txTestDelay.Text == "") txTestDelay.Text = "0.3";
            lnkHome.Links.Add(0, 1000, "http://www.wellenvogel.net/software/avnav/index.php");
            lbVersion.Text = getVersion();
            if (canUpdate)
            {
                string servercmd = Path.Combine(myPath, "server", "avnav_server.py");
                if (!File.Exists(servercmd))
                {
                    showUpdateDialog("Software Installation not found, try to download");
                }
            }
        }

        private string getVersion()
        {
            string versionFile = Path.Combine(myPath, "server", "avnav_server_version.py");
            string version = "W" + Application.ProductVersion;
            if (!File.Exists(versionFile)) return version;
            using (StreamReader reader = new StreamReader(versionFile))
            {
                string line = reader.ReadLine();
                while (line != null)
                {
                    if (Regex.Match(line, ".*AVNAV_VERSION=.*").Success)
                    {
                        line = Regex.Replace(line, ".*AVNAV_VERSION=\"", "");
                        line = Regex.Replace(line, "\".*", "");
                        version = line;
                        break;
                    }
                    line = reader.ReadLine();
                }
            }
            return version;
        }

        private int serverConfigFromTemplate(string template, string outfile, Dictionary<string, string> replacements)
        {
            if (!File.Exists(template))
            {
                MessageBox.Show("Exception while creating config " + outfile + ": template " + template + " not found", "Error creating server config", MessageBoxButtons.OK);
                return -1;
            }
            string dir = Path.GetDirectoryName(outfile).Replace("..\\", "");
            if (!Directory.Exists(dir))
            {
                Directory.CreateDirectory(dir);
            }
            try
            {
                using (StreamWriter writer = new StreamWriter(outfile))
                {
                    using (StreamReader reader = new StreamReader(template))
                    {
                        string line = reader.ReadLine();
                        while (line != null)
                        {
                            foreach (string k in replacements.Keys)
                            {
                                line = line.Replace("<!--" + k + "-->", replacements[k]);
                            }
                            writer.WriteLine(line);
                            line = reader.ReadLine();
                        }
                    }
                }
            }
            catch (Exception e)
            {
                Console.WriteLine("Exception while creating config " + outfile + ": " + e);
                MessageBox.Show("Exception while creating config " + outfile + ": " + e, "Error creating server config", MessageBoxButtons.OK);
                return -1;
            }
            return 0;
        }

        private string createServerConfig()
        {
            if (rbModeCustom.Checked)
            {
                if (File.Exists(txUserConfig.Text))
                {
                    //nothing to be done
                    return txUserConfig.Text;
                }
                serverConfigFromTemplate(serverconfigtemplate, txUserConfig.Text, new Dictionary<string, string>());
                return txUserConfig.Text;
            }
            Dictionary<string, string> replace = new Dictionary<string, string>();
            if (rbModeTest.Checked)
            {
                replace.Add("IPREADER", "<AVNSocketReader host=\"localhost\" port=\"" + txTestPort.Text + "\"/>");
            }
            if (rbModeIP.Checked)
            {
                replace.Add("IPREADER", "<AVNSocketReader host=\"" + txIpAddress.Text + "\" port=\"" + txIpPort.Text + "\"/>");
            }
            if (rbModeCom.Checked)
            {
                if (lbComPort.Items.Count > 0)
                {
                    string comport = (string)lbComPort.SelectedItem;
                    //comport = comport.Replace("COM", "");
                    if (comport != "")
                    {
                        replace.Add("COMREADER", "<AVNSerialReader useFeeder=\"true\" name=\"com" + comport + "reader\" port=\"" + comport + "\" baud=\"38400\" minbaud=\"4800\"/>");
                    }
                }
            }
            serverConfigFromTemplate(serverconfigtemplate, serverconfig, replace);
            return serverconfig;
        }


        private void buttonAddFile_Click(object sender, EventArgs e)
        {
            this.openInputDialog.Reset();
            this.openInputDialog.Title = "Select Files or Directories";
            this.openInputDialog.Multiselect = true;
            this.openInputDialog.FileName = "Folder Selection";
            this.openInputDialog.ValidateNames = false;
            this.openInputDialog.CheckFileExists = false;
            this.openInputDialog.CheckPathExists = false;
            this.openInputDialog.Filter = string.Empty;
            if (lastdir != null) this.openInputDialog.InitialDirectory = lastdir;
            if (this.openInputDialog.ShowDialog() == DialogResult.OK)
            {
                foreach (String fn in this.openInputDialog.FileNames)
                {
                    lastdir = Path.GetDirectoryName(fn);
                    this.textIn.AppendText(fn + "\n");
                }
                Properties.Settings.Default["InputDir"] = lastdir;
                Properties.Settings.Default.Save();
            }


        }

        private void buttonAddDirectories_Click(object sender, EventArgs e)
        {
            if (this.folderBrowserInput.ShowDialog() == DialogResult.OK)
            {
                this.textIn.AppendText(this.folderBrowserInput.SelectedPath + "\n");
            }
        }

        private void buttonCancel_Click(object sender, EventArgs e)
        {
            this.buttonStop_Click(null, null);
            this.Close();
        }

        private void buttonOutDir_Click(object sender, EventArgs e)
        {
            this.folderBrowserOutput.SelectedPath = this.textOutdir.Text;
            if (this.folderBrowserInput.ShowDialog() == DialogResult.OK)
            {
                this.textOutdir.Text = this.folderBrowserInput.SelectedPath;
            }
        }

        private void buttonOK_Click(object sender, EventArgs e)
        {
            if (converter != null)
            {
                if (converter.HasExited)
                {
                    converter = null;
                }
                else
                {
                    MessageBox.Show("Converter already running");
                }
            }
            Process p = new Process();
            String[] infiles = this.textIn.Text.Split('\n');
            if (infiles.Length < 1 || (infiles.Length == 1 && infiles[0] == ""))
            {
                MessageBox.Show("No input files");
                return;
            }
            try
            {
                ProcessStartInfo info = null;
                String args = null;


                String cmd = Path.Combine(scriptpath, "read_charts.py");
                if (!File.Exists(cmd))
                {
                    MessageBox.Show("command not found at " + cmd + " - unable to execute");
                    return;
                }
                args = " ";
                info = getPythonCommandPath(cmd);

                if (cbLogFile.Checked)
                {
                    args += " -e \"" + tbLogFile.Text + "\"";
                }
                if (cbNewGemf.Checked)
                {
                    args += " -g";
                }
                //MessageBox.Show("CMD:" + cmd);
                if (!this.checkBoxUpdate.Checked) args += " -f";
                args += " -b " + "\"" + this.textOutdir.Text + "\"";
                foreach (String inf in infiles)
                {
                    args += " \"" + inf + "\"";
                }
                info.Arguments += args;
                info.UseShellExecute = false;
                info.RedirectStandardError = true;
                info.RedirectStandardOutput = true;
                info.CreateNoWindow = true;
                p.StartInfo = info;
                enableDoneAction = true;
                if (logDisplay != null) logDisplay.Dispose();
                logDisplay = new ProcessLog("Converter", this);
                p.ErrorDataReceived += (proc, oline) =>
                {
                    logDisplay.addLogText(oline.Data);
                };

                p.OutputDataReceived += (proc, oline) =>
                {
                    logDisplay.addLogText(oline.Data);
                };
                logDisplay.Show();
                p.Start();
                p.BeginOutputReadLine();
                p.BeginErrorReadLine();

                this.labelProcess.Text = "Converter started with pid " + p.Id;
                this.buttonFocus.Visible = true;
                this.buttonStop.Visible = true;
                converter = p;
            }
            catch (Exception exc)
            {
                MessageBox.Show("Exception when starting:" + exc.Message);
            }

            // process output

        }
        private void converterDone()
        {
            if (logDisplay != null) logDisplay.addLogText("***Converter finished ***");
            if (!enableDoneAction) return;
            if (this.checkStartServer.Checked) startServer();
        }

        private void timer1_Tick(object sender, EventArgs e)
        {
            if (converter != null)
            {
                try
                {
                    converter.Refresh();
                    if (converter.HasExited)
                    {
                        converter.Refresh();
                        converter = null;
                        converterDone();
                    }

                }
                catch (Exception ex1)
                {
                    String txt = ex1.Message;
                }

            }
            this.buttonOK.Enabled = (converter == null);
            this.buttonStop.Visible = (converter != null);
            this.buttonFocus.Visible = (converter != null);
            if (converter == null)
            {
                this.labelProcess.Text = "";

            }
            if (File.Exists(tbLogFile.Text))
            {
                if (!btViewLog.Visible) btViewLog.Show();
            }
            else
            {
                if (btViewLog.Visible) btViewLog.Hide();
            }
        }

        public void stopConverter()
        {
            enableDoneAction = false;

            if (converter != null)
            {
                try
                {
                    if (converter != null && !converter.HasExited)
                    {
                        if (logDisplay != null) logDisplay.addLogText("**stop initiated, wating...");
                        converter.Kill();
                    }

                }
                catch (Exception exc)
                {
                    String txt = exc.Message;
                    Console.WriteLine(txt);
                }
            }
        }

        private void buttonStop_Click(object sender, EventArgs e)
        {
            stopConverter();
        }

        private void buttonDefaultOut_Click(object sender, EventArgs e)
        {
            this.textOutdir.Text = defaultOut;
        }

        private void buttonEmpty_Click(object sender, EventArgs e)
        {
            this.textIn.Clear();
        }

        private void buttonFocus_Click(object sender, EventArgs e)
        {
            if (converter != null)
            {
                SetForegroundWindow(converter.MainWindowHandle);
            }
        }

        private void textOutdir_TextChanged(object sender, EventArgs e)
        {
            Properties.Settings.Default["OutDir"] = textOutdir.Text;
            Properties.Settings.Default.Save();

        }


        private bool isServerRunning()
        {
            try
            {
                if (serverProcess == null) return false;
                serverProcess.Refresh();
                if (serverProcess.HasExited)
                {
                    serverProcess = null;
                    if (server != null)
                    {
                        server.stop();
                    }
                    return false;
                }
                return true;
            }
            catch (Exception) { }
            return false;
        }

        private void startServer()
        {
            if (isServerRunning()) return;
            if (this.server != null) this.server.stop();
            ProcessStartInfo info = null;
            string cmd = null;
            string args = null;
            string configfile = createServerConfig();

            cmd = Path.Combine(serverpath, "avnav_server.py");
            if (!File.Exists(cmd))
            {
                MessageBox.Show("server command " + cmd + " not found");
                return;
            }
            args = "";


            info = getPythonCommandPath(cmd);
            args += " -c \"" + Path.Combine(textOutdir.Text, "out") + "\" ";
            args += " -u \"viewer=" + viewerpath + "\"";
            args += " \"" + configfile + "\"";
            info.Arguments += args;
            info.RedirectStandardInput = false;
            info.RedirectStandardOutput = false;
            info.UseShellExecute = false;
            info.WorkingDirectory = scriptpath;
            serverProcess = new Process();
            serverProcess.StartInfo = info;

            if (this.rbModeTest.Checked)
            {
                double delayS = 0.3;
                try
                {
                    char a = Convert.ToChar(CultureInfo.CurrentCulture.NumberFormat.NumberDecimalSeparator);
                    delayS = Convert.ToDouble(txTestDelay.Text.Replace(',', a).Replace('.', a));
                }
                catch (Exception e)
                {
                    MessageBox.Show("invalid delay time " + txTestDelay.Text + ", using 0.3s");
                }
                if (!File.Exists(this.txTestData.Text))
                {
                    MessageBox.Show("No file " + this.txTestData.Text + " found, unable to run simulation");

                }
                else
                {
                    if (this.server != null)
                    {
                        this.server.stop();
                    }

                    this.server = new SocketServer(this.txTestData.Text, Convert.ToInt32(txTestPort.Text), Convert.ToInt32(delayS * 1000));
                    try
                    {
                        this.server.start();
                    }
                    catch (Exception e)
                    {
                        MessageBox.Show("Unable to start Emulation Data Server: " + e.Message);
                    }
                }
            }
            serverProcess.Start();
            this.lbServerRunning.Text = "Server pid " + serverProcess.Id;
            this.lbServerRunning.ForeColor = System.Drawing.Color.FromArgb(0, 192, 0);
            this.btnStopServer.Visible = true;

            if (cbBrowser.Checked)
            {
                Process.Start(tbUrl.Text);
            }
        }

        private void stopServer()
        {
            if (server != null)
            {
                server.stop();
                server = null;
            }
            if (!isServerRunning()) return;
            try
            {

                serverProcess.Kill();
            }
            catch (Exception) { }
        }

        private void timer2_Tick(object sender, EventArgs e)
        {
            if (!isServerRunning() && this.btnStopServer.Visible)
            {
                this.btnStopServer.Visible = false;
                this.lbServerRunning.Text = "Server stopped";
                this.lbServerRunning.ForeColor = System.Drawing.Color.FromArgb(192, 0, 0);
            }
        }

        private void btnStartServer_Click(object sender, EventArgs e)
        {
            startServer();
        }

        private void btnStopServer_Click(object sender, EventArgs e)
        {
            stopServer();
        }

        private void Form1_FormClosing(object sender, FormClosingEventArgs e)
        {
            stopServer();
            buttonStop_Click(null, null);
        }

        private void btLogFile_Click(object sender, EventArgs e)
        {
            this.openOutputDialog.Reset();
            this.openOutputDialog.Title = "Select Logfile";
            this.openOutputDialog.FileName = tbLogFile.Text;
            this.openOutputDialog.ValidateNames = false;
            this.openOutputDialog.CheckFileExists = false;
            this.openOutputDialog.CheckPathExists = true;
            this.openOutputDialog.Filter = string.Empty;
            if (this.openOutputDialog.ShowDialog() == DialogResult.OK)
            {
                tbLogFile.Text = openOutputDialog.FileName;
                Properties.Settings.Default["LogFile"] = tbLogFile.Text;
                Properties.Settings.Default.Save();
            }
        }

        private void btViewLog_Click(object sender, EventArgs e)
        {
            if (!File.Exists(tbLogFile.Text))
            {
                MessageBox.Show("Logfile " + tbLogFile.Text + " does not exist");
                return;
            }
            try
            {
                Process.Start(tbLogFile.Text);
            }
            catch (Exception ex)
            {
                MessageBox.Show("Exception when showing " + tbLogFile.Text + ": " + ex);
            }
        }



        private void tbUrl_TextChanged(object sender, EventArgs e)
        {
            Properties.Settings.Default["LocalUrl"] = tbUrl.Text;
            Properties.Settings.Default.Save();
        }

        private void btTestData_Click(object sender, EventArgs e)
        {
            this.openInputDialog.Reset();
            this.openInputDialog.Title = "Select TestData";
            this.openInputDialog.Multiselect = false;
            this.openInputDialog.FileName = Path.GetFileName(this.txTestData.Text);
            this.openInputDialog.CheckFileExists = true;
            this.openInputDialog.CheckPathExists = true;
            this.openInputDialog.Filter = string.Empty;
            string dir = Path.GetDirectoryName(this.txTestData.Text).Replace("..\\", "");
            this.openInputDialog.InitialDirectory = dir;

            if (this.openInputDialog.ShowDialog() == DialogResult.OK)
            {
                testdir = Path.GetDirectoryName(this.openInputDialog.FileName);
                this.txTestData.Text = this.openInputDialog.FileName;
            }
        }

        private void txTestData_TextChanged(object sender, EventArgs e)
        {
            Properties.Settings.Default["TestData"] = txTestData.Text;
            Properties.Settings.Default.Save();
        }

        private void rbModeTest_CheckedChanged(object sender, EventArgs e)
        {
            if (rbModeTest.Checked) servermode = "test";
            handleServerModeChange();
        }

        private void handleServerModeChange()
        {
            if (rbModeTest.Checked) pTestData.Show(); else pTestData.Hide();
            if (rbModeCustom.Checked) pUserConfig.Show(); else pUserConfig.Hide();
            if (rbModeIP.Checked) pIp.Show(); else pIp.Hide();
            if (rbModeCom.Checked) pCom.Show(); else pCom.Hide();
            Properties.Settings.Default["ServerMode"] = servermode;
            Properties.Settings.Default.Save();
            fillComPorts();
            stopServer();
        }

        private void rbModeCom_CheckedChanged(object sender, EventArgs e)
        {
            if (rbModeCom.Checked) servermode = "com";
            handleServerModeChange();
        }

        private void rbModeIP_CheckedChanged(object sender, EventArgs e)
        {
            if (rbModeIP.Checked) servermode = "ip";
            handleServerModeChange();
        }

        private void rbModeCustom_CheckedChanged(object sender, EventArgs e)
        {
            if (rbModeCustom.Checked) servermode = "custom";
            handleServerModeChange();
        }

        private void txUserConfig_TextChanged(object sender, EventArgs e)
        {
            Properties.Settings.Default["UserConfig"] = txUserConfig.Text;
            Properties.Settings.Default.Save();
            stopServer();
        }

        private void txIpPort_TextChanged(object sender, EventArgs e)
        {
            Properties.Settings.Default["IPPort"] = txIpPort.Text;
            Properties.Settings.Default.Save();
            stopServer();
        }

        private void txIpAddress_TextChanged(object sender, EventArgs e)
        {
            Properties.Settings.Default["IpAddress"] = txIpAddress.Text;
            Properties.Settings.Default.Save();
            stopServer();
        }

        private void lbComPort_SelectedIndexChanged(object sender, EventArgs e)
        {
            Properties.Settings.Default["ComPort"] = lbComPort.SelectedItem;
            Properties.Settings.Default.Save();
            stopServer();
        }

        private void fillComPorts()
        {
            string[] ports = SerialPort.GetPortNames();
            lbComPort.Items.Clear();
            int index = 0;
            int found = -1;
            string selected = (string)Properties.Settings.Default["ComPort"];
            foreach (string port in ports)
            {
                lbComPort.Items.Add(port);
                if (port == selected)
                {
                    found = index;
                }
                index++;
            }
            if (lbComPort.Items.Count > 0)
            {
                if (found >= 0) lbComPort.SelectedIndex = found;
                else lbComPort.SelectedIndex = 0;
            }
        }

        private void btRefreshCom_Click(object sender, EventArgs e)
        {
            fillComPorts();
        }

        private void btChangeUserConfig_Click(object sender, EventArgs e)
        {
            this.openInputDialog.Reset();
            this.openInputDialog.Title = "Select User Config File";
            this.openInputDialog.Multiselect = false;
            this.openInputDialog.FileName = Path.GetFileName(this.txUserConfig.Text);
            this.openInputDialog.CheckFileExists = false;
            this.openInputDialog.CheckPathExists = true;
            this.openInputDialog.Filter = string.Empty;
            string dir = Path.GetDirectoryName(this.txUserConfig.Text).Replace("..\\", "");
            this.openInputDialog.InitialDirectory = dir;

            if (this.openInputDialog.ShowDialog() == DialogResult.OK)
            {
                stopServer();
                testdir = Path.GetDirectoryName(this.openInputDialog.FileName);
                this.txUserConfig.Text = this.openInputDialog.FileName;
            }
        }

        private void btEditUserConfig_Click(object sender, EventArgs e)
        {
            if (!File.Exists(txUserConfig.Text))
            {
                serverConfigFromTemplate(serverconfigtemplate, txUserConfig.Text, new Dictionary<string, string>());
            }
            stopServer();
            try
            {
                Process.Start(@"notepad.exe", txUserConfig.Text);
            }
            catch (Exception ex)
            {
                MessageBox.Show("Exception when showing " + txUserConfig.Text + ": " + ex);
            }
        }

        private void txTestPort_TextChanged(object sender, EventArgs e)
        {
            Properties.Settings.Default["TestPort"] = Convert.ToInt32(txTestPort.Text);
            Properties.Settings.Default.Save();
            stopServer();
        }

        private void txTestDelay_TextChanged(object sender, EventArgs e)
        {
            Properties.Settings.Default["TestDelay"] = txTestDelay.Text;
            Properties.Settings.Default.Save();
            stopServer();
        }

        private void lnkHome_LinkClicked(object sender, LinkLabelLinkClickedEventArgs e)
        {
            Process.Start(e.Link.LinkData.ToString());
        }

        private void textIn_TextChanged(object sender, EventArgs e)
        {

        }

        private void button1_Click(object sender, EventArgs e)
        {
            showUpdateDialog("Update Avnav");
        }

        private bool showUpdateDialog(string actionText)
        {
            var updateDialog = new UpdateForm();
            updateDialog.initialize(lbVersion.Text, (string)Properties.Settings.Default["UpdateUrl"], actionText);
            updateDialog.ShowDialog();
            if (updateDialog.DialogResult == DialogResult.OK)
            {
                string dlScript = "downloadAndInstall.ps1";
                string location1 = Path.Combine(myPath, "windows", dlScript);
                string currentDlPath = null;
                if (File.Exists(location1))
                {
                    currentDlPath = location1;
                }
                else
                {
                    string location2 = Path.Combine(assemblyPath, "windows", dlScript);
                    if (!File.Exists(location2))
                    {
                        MessageBox.Show("unable to find the download script at " + location2);
                        return false;
                    }
                    currentDlPath = location2;
                }
                ProcessStartInfo info = new ProcessStartInfo(@"powershell.exe");
                info.Arguments = " -executionpolicy unrestricted -file \"" + currentDlPath + "\" \"" + updateDialog.getUpdateUrl() + "\"";
                info.RedirectStandardInput = false;
                info.RedirectStandardOutput = false;
                info.RedirectStandardError = false;
                info.UseShellExecute = false;
                Process updater = new Process();
                updater.StartInfo = info;
                updater.EnableRaisingEvents = true;
                updater.Exited += new EventHandler(updateVersion);
                updater.Start();
            }
            return true;
        }
        private void updateVersion(object sender, System.EventArgs e)
        {
            if (InvokeRequired)
            {
                this.Invoke(new Action<object,System.EventArgs>(updateVersion), new object[] { sender,e });
                return;
            }
            lbVersion.Text = getVersion();
        }

        private void button1_Click_1(object sender, EventArgs e)
        {
            var confirm = MessageBox.Show("Delete downloaded software at " + myPath + "?","Confirm deletion", MessageBoxButtons.YesNo);
            if (confirm == DialogResult.Yes)
            {
                try
                {
                    Directory.Delete(myPath, true);
                    lbVersion.Text = getVersion();
                }
                catch (Exception ex)
                {
                    MessageBox.Show("deletion failed: " + ex.Message);
                }
            }
        }
    }
}