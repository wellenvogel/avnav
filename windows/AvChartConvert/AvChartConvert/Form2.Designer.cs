namespace AvChartConvert
{
    partial class UpdateForm
    {
        /// <summary>
        /// Required designer variable.
        /// </summary>
        private System.ComponentModel.IContainer components = null;

        /// <summary>
        /// Clean up any resources being used.
        /// </summary>
        /// <param name="disposing">true if managed resources should be disposed; otherwise, false.</param>
        protected override void Dispose(bool disposing)
        {
            if (disposing && (components != null))
            {
                components.Dispose();
            }
            base.Dispose(disposing);
        }

        #region Windows Form Designer generated code

        /// <summary>
        /// Required method for Designer support - do not modify
        /// the contents of this method with the code editor.
        /// </summary>
        private void InitializeComponent()
        {
            this.buttonOK = new System.Windows.Forms.Button();
            this.buttonCancel = new System.Windows.Forms.Button();
            this.downloadUrl = new System.Windows.Forms.TextBox();
            this.updateLabel = new System.Windows.Forms.Label();
            this.currentVersion = new System.Windows.Forms.Label();
            this.label1 = new System.Windows.Forms.Label();
            this.label2 = new System.Windows.Forms.Label();
            this.SuspendLayout();
            // 
            // buttonOK
            // 
            this.buttonOK.Location = new System.Drawing.Point(407, 132);
            this.buttonOK.Name = "buttonOK";
            this.buttonOK.Size = new System.Drawing.Size(75, 23);
            this.buttonOK.TabIndex = 0;
            this.buttonOK.Text = "OK";
            this.buttonOK.UseVisualStyleBackColor = true;
            // 
            // buttonCancel
            // 
            this.buttonCancel.Location = new System.Drawing.Point(326, 132);
            this.buttonCancel.Name = "buttonCancel";
            this.buttonCancel.Size = new System.Drawing.Size(75, 23);
            this.buttonCancel.TabIndex = 1;
            this.buttonCancel.Text = "Cancel";
            this.buttonCancel.UseVisualStyleBackColor = true;
            this.buttonCancel.Click += new System.EventHandler(this.button1_Click);
            // 
            // downloadUrl
            // 
            this.downloadUrl.Location = new System.Drawing.Point(23, 94);
            this.downloadUrl.Name = "downloadUrl";
            this.downloadUrl.Size = new System.Drawing.Size(459, 20);
            this.downloadUrl.TabIndex = 2;
            // 
            // updateLabel
            // 
            this.updateLabel.AutoSize = true;
            this.updateLabel.Font = new System.Drawing.Font("Microsoft Sans Serif", 11F, System.Drawing.FontStyle.Regular, System.Drawing.GraphicsUnit.Point, ((byte)(0)));
            this.updateLabel.Location = new System.Drawing.Point(20, 20);
            this.updateLabel.Name = "updateLabel";
            this.updateLabel.Size = new System.Drawing.Size(98, 18);
            this.updateLabel.TabIndex = 3;
            this.updateLabel.Text = "Update Avnav";
            // 
            // currentVersion
            // 
            this.currentVersion.AutoSize = true;
            this.currentVersion.Location = new System.Drawing.Point(101, 51);
            this.currentVersion.Name = "currentVersion";
            this.currentVersion.Size = new System.Drawing.Size(75, 13);
            this.currentVersion.TabIndex = 4;
            this.currentVersion.Text = "currentVersion";
            // 
            // label1
            // 
            this.label1.AutoSize = true;
            this.label1.Location = new System.Drawing.Point(20, 51);
            this.label1.Name = "label1";
            this.label1.Size = new System.Drawing.Size(79, 13);
            this.label1.TabIndex = 5;
            this.label1.Text = "Current Version";
           
            // 
            // label2
            // 
            this.label2.AutoSize = true;
            this.label2.Location = new System.Drawing.Point(20, 78);
            this.label2.Name = "label2";
            this.label2.Size = new System.Drawing.Size(61, 13);
            this.label2.TabIndex = 6;
            this.label2.Text = "Update Url:";
           
            // 
            // UpdateForm
            // 
            this.AutoScaleDimensions = new System.Drawing.SizeF(6F, 13F);
            this.AutoScaleMode = System.Windows.Forms.AutoScaleMode.Font;
            this.ClientSize = new System.Drawing.Size(490, 167);
            this.Controls.Add(this.label2);
            this.Controls.Add(this.label1);
            this.Controls.Add(this.currentVersion);
            this.Controls.Add(this.updateLabel);
            this.Controls.Add(this.downloadUrl);
            this.Controls.Add(this.buttonCancel);
            this.Controls.Add(this.buttonOK);
            this.Name = "UpdateForm";
            this.Text = "Update Software";
            this.ResumeLayout(false);
            this.PerformLayout();

        }

        #endregion

        private System.Windows.Forms.Button buttonOK;
        private System.Windows.Forms.Button buttonCancel;
        private System.Windows.Forms.TextBox downloadUrl;
        private System.Windows.Forms.Label updateLabel;
        private System.Windows.Forms.Label currentVersion;
        private System.Windows.Forms.Label label1;
        private System.Windows.Forms.Label label2;
    }
}