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
using System.Runtime.InteropServices;


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
        String myPath = System.IO.Path.GetDirectoryName(
          System.Reflection.Assembly.GetExecutingAssembly().GetName().CodeBase).Replace("file:\\", "");
        Process serverProcess = null;
        bool enableDoneAction = false;
        public Form1()
        {
            InitializeComponent();
            defaultOut= Environment.GetFolderPath(Environment.SpecialFolder.UserProfile)+"\\"+BASE;
            string outdir = (string)Properties.Settings.Default["OutDir"];
            if (outdir == null || outdir == "") outdir = defaultOut;
            this.textOutdir.Text = outdir;
            this.textIn.Clear();
            this.textOpenCPN.Text=locateOpenCpn((string)Properties.Settings.Default["OpenCPN"]);
            string[] args = Environment.GetCommandLineArgs();
            bool hasOpenCpnConvert = File.Exists(Path.Combine(new[] { myPath, "..\\chartconvert\\convert_nv.py" }));
            showOpenCPN(hasOpenCpnConvert);
            if (args.Length > 1){
                for (int i = 1; i < args.Length;i++ )
                {
                    this.textIn.AppendText(args[i] + "\n");
                }
                this.buttonOK_Click(null, null);
            }
        }

        private void showOpenCPN(bool show)
        {
            this.textOpenCPN.Visible = show;
            this.labelOpenCPN.Visible = show;
            this.buttonOpenCPN.Visible = show;
        }

        //get the directory where opencpn is found
        private string locateOpenCpn(string currdir)
        {
            string ename = "opencpn.exe";
            if (currdir != null && currdir != "")
            {
                string completeName = Path.Combine(currdir, ename);
                if (File.Exists(completeName)) return currdir;
            }
            //either not found or empty...
            foreach (Environment.SpecialFolder f 
                in new []{Environment.SpecialFolder.ProgramFiles, Environment.SpecialFolder.ProgramFilesX86})
            {
                string dir=Path.Combine(Environment.GetFolderPath(f),"OpenCPN");
                string completeName = Path.Combine(dir,ename);
                if (File.Exists(completeName)) return dir;
            }
            return null;
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
            if (lastdir!=null)this.openInputDialog.InitialDirectory = lastdir;
            if (this.openInputDialog.ShowDialog() == DialogResult.OK)
            {
                foreach (String fn in this.openInputDialog.FileNames){
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
                    
                    String cmd1 = myPath + "\\..\\..\\..\\..\\AvChartConvert.cmd";
                    String cmd2 = myPath + "\\AvChartConvert.cmd";
                    String cmd=null;
                    if (File.Exists(cmd1))
                    {
                        cmd = cmd1;
                    }
                    if (File.Exists(cmd2))
                    {
                        cmd = cmd2;
                    }
                    if (cmd == null)
                    {
                        MessageBox.Show("command not found at " + cmd1 + " and at " + cmd2 + " - unable to execute");
                        return;
                    }
                    //MessageBox.Show("CMD:" + cmd);
                    ProcessStartInfo info = new ProcessStartInfo("cmd.exe");
                    String args = "/K " + cmd;
                    if (!this.checkBoxUpdate.Checked) args += " -f";
                    args += " -b " + "\"" + this.textOutdir.Text + "\"";
                    if (this.textOpenCPN.Visible && this.textOpenCPN.Text != "")
                    {
                        args += " -n \"" + this.textOpenCPN.Text + "\" ";
                    }
                    foreach (String inf in infiles)
                    {
                        args += " \"" + inf + "\"";
                    }
                    info.Arguments = args;
                    info.RedirectStandardInput = false;
                    info.RedirectStandardOutput = false;
                    info.UseShellExecute = true;
                    p.StartInfo = info;
                    enableDoneAction = true;
                    p.Start();
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
                catch (Exception ex1) {
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
        }

        private void buttonStop_Click(object sender, EventArgs e)
        {
            enableDoneAction = false;

            if (converter != null)
            {
                try
                {
                    ProcessUtilities.KillProcessTree(converter);
                }
                catch (Exception exc) {
                    String txt = exc.Message;
                }
            }
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

        private void buttonOpenCPN_Click(object sender, EventArgs e)
        {
            this.openInputDialog.Reset();
            this.openInputDialog.Title = "Select OpenCPN Location";
            this.openInputDialog.Multiselect = false;
            this.openInputDialog.FileName = "opencpn.exe";
            this.openInputDialog.ValidateNames = true;
            this.openInputDialog.CheckFileExists = true;
            this.openInputDialog.CheckPathExists = true;
            this.openInputDialog.Filter = "opencpn|opencpn.exe";
            this.openInputDialog.InitialDirectory = this.textOpenCPN.Text;
            
            if (this.openInputDialog.ShowDialog() == DialogResult.OK)
            {
            
                foreach (String fn in this.openInputDialog.FileNames)
                {
                    string newdir = locateOpenCpn(Path.GetDirectoryName(fn));
                    if (newdir != null)
                    {
                        this.textOpenCPN.Text = newdir;
                        Properties.Settings.Default["OpenCPN"] = newdir;
                        Properties.Settings.Default.Save();
                    }
                }
            }
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
                    return false;
                }
                return true;
            }
            catch (Exception ) { }
            return false;
        }

        private void startServer()
        {
            if (isServerRunning()) return;
            ProcessStartInfo info = new ProcessStartInfo("cmd.exe");
            string cmd = Path.Combine(myPath, "anav.cmd");
            if (!File.Exists(cmd))
            {
                MessageBox.Show("server command " + cmd + " not found");
                return;
            }
            String args = "/K " + cmd;
            args += " -c \"" + Path.Combine(textOutdir.Text,"out") + "\" "; 
            info.Arguments = args;
            info.RedirectStandardInput = false;
            info.RedirectStandardOutput = false;
            info.UseShellExecute = true;
            serverProcess=new Process();
            serverProcess.StartInfo = info;
            serverProcess.Start();
            this.lbServerRunning.Text = "Server running with pid " + serverProcess.Id;
            this.lbServerRunning.ForeColor = System.Drawing.Color.FromArgb(0, 192, 0);
            this.btnStopServer.Visible = true;
        }

        private void stopServer()
        {
            if (!isServerRunning()) return;
            try
            {
                ProcessUtilities.KillProcessTree(serverProcess);
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
    }
    //taken from http://stackoverflow.com/questions/5901679/kill-process-tree-programatically-in-c-sharp
    class ProcessUtilities
    {
        public static void KillProcessTree(Process root)
        {
            if (root != null)
            {
                var list = new List<Process>();
                GetProcessAndChildren(Process.GetProcesses(), root, list, 1);

                foreach (Process p in list)
                {
                    try
                    {
                        p.Kill();
                    }
                    catch (Exception ex)
                    {
                        //Log error?
                    }
                }
            }
        }

        private static int GetParentProcessId(Process p)
        {
            int parentId = 0;
            try
            {
                ManagementObject mo = new ManagementObject("win32_process.handle='" + p.Id + "'");
                mo.Get();
                parentId = Convert.ToInt32(mo["ParentProcessId"]);
            }
            catch (Exception ex)
            {
                Console.WriteLine(ex.ToString());
                parentId = 0;
            }
            return parentId;
        }

        private static void GetProcessAndChildren(Process[] plist, Process parent, List<Process> output, int indent)
        {
            foreach (Process p in plist)
            {
                if (GetParentProcessId(p) == parent.Id)
                {
                    GetProcessAndChildren(plist, p, output, indent + 1);
                }
            }
            output.Add(parent);
        }

       
    }
}
