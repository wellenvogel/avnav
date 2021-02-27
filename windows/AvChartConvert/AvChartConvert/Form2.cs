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
    public partial class UpdateForm : Form
    {
        public UpdateForm()
        {
            InitializeComponent();
            buttonCancel.DialogResult = DialogResult.Cancel;
            buttonOK.DialogResult = DialogResult.OK;

        }

        public void initialize(string currentVersionText, string downloadUrlDefault, string actionText)
        {
            currentVersion.Text = currentVersionText;
            downloadUrl.Text = downloadUrlDefault;
            updateLabel.Text = actionText;
        }

        public string getUpdateUrl()
        {
            return downloadUrl.Text;
        }

        private void button1_Click(object sender, EventArgs e)
        {
            this.Dispose();
        }

        
    }
}
