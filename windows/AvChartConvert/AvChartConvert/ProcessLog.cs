using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Data;
using System.Drawing;
using System.Linq;
using System.Text;
using System.Windows.Forms;

namespace AvChartConvert
{
    public partial class ProcessLog : Form
    {
        private Form1 callback;
        public ProcessLog(string title, Form1 callback)
        {
            InitializeComponent();
            this.callback = callback;
            this.Text = title;
        }

       

        private void button1_Click(object sender, EventArgs e)
        {
            callback.stopConverter();
        }

        private void ProcessLog_FormClosing(object sender, FormClosingEventArgs e)
        {
            callback.stopConverter();
        }

        public void addLogText(string text)
        {
            if (InvokeRequired)
            {
                this.Invoke(new Action<string>(addLogText), new object[] { text });
                return;
            }
            if (IsDisposed) return;
            logText.AppendText(text + "\r\n");
            logText.SelectionStart = logText.Text.Length;
            logText.ScrollToCaret();  
        }

      

        
    }
}
