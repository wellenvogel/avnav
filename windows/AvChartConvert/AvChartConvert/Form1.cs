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


namespace AvChartConvert
{
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
    public partial class Form1 : Form
    {
        const String BASE = "AvNavCharts";
        String defaultOut = null;
        Process converter = null;
        public Form1()
        {
            InitializeComponent();
            defaultOut= Environment.GetFolderPath(Environment.SpecialFolder.UserProfile)+"\\"+BASE;
            this.textOutdir.Text = defaultOut;
            string[] args = Environment.GetCommandLineArgs();
            if (args.Length > 1){
                for (int i = 1; i < args.Length;i++ )
                {
                    this.textIn.AppendText(args[i] + "\n");
                }
                this.buttonOK_Click(null, null);
            }
        }

        private void buttonAddFile_Click(object sender, EventArgs e)
        {
            this.openInputDialog.Title = "Select Files or Directories";
            this.openInputDialog.Multiselect = true;
            this.openInputDialog.FileName = "Folder Selection";
            this.openInputDialog.ValidateNames = false;
            this.openInputDialog.CheckFileExists = false;
            this.openInputDialog.CheckPathExists = false;
            this.openInputDialog.Filter = string.Empty;
            if (this.openInputDialog.ShowDialog() == DialogResult.OK)
            {
                foreach (String fn in this.openInputDialog.FileNames){
                    this.textIn.AppendText(fn + "\n");
                }
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
            try
                {
                    String myPath = System.IO.Path.GetDirectoryName(
          System.Reflection.Assembly.GetExecutingAssembly().GetName().CodeBase).Replace("file:\\", "");
                    String cmd = myPath + "\\..\\..\\..\\..\\AvChartConvert.cmd";
                    //MessageBox.Show("CMD:" + cmd);
                    ProcessStartInfo info = new ProcessStartInfo("cmd.exe");
                    String args = "/K " + cmd;
                    if (!this.checkBoxUpdate.Checked) args += " -f";
                    args += " -b " + "\"" + this.textOutdir.Text + "\"";
                    foreach (String inf in this.textIn.Text.Split('\n'))
                    {
                        args += " \"" + inf + "\"";
                    }
                    info.Arguments = args;
                    info.RedirectStandardInput = false;
                    info.RedirectStandardOutput = false;
                    info.UseShellExecute = true;
                    p.StartInfo = info;
                    p.Start();
                    converter = p;
                }
                catch (Exception exc)
                {
                    MessageBox.Show("Exception when starting:" + exc.Message);
                }
                
                // process output
            
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
                    }
                    
                }
                catch (Exception ex1) {
                    String txt = ex1.Message;
                }
                
            }
            this.buttonOK.Enabled = (converter == null);
            this.buttonStop.Enabled = (converter != null);
        }

        private void buttonStop_Click(object sender, EventArgs e)
        {
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
    }
}
