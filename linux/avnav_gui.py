#!/usr/bin/env python
# -*- coding: utf-8 -*-
# vim: ts=2 sw=2 et ai
###############################################################################
# Copyright (c) 2012,2014 Andreas Vogel andreas@wellenvogel.net
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
###############################################################################
import sys
import os
import wx
from avnav_gui_design import *
import subprocess
import re
__author__ = 'andreas'

class  AvnavGui(Avnav):
    def __init__(self, *args, **kwds):
        Avnav.__init__(self, *args, **kwds)
        self.defaultOut=os.path.join(os.path.expanduser("~"),"AvNavCharts")
        self.outputDir.SetValue(self.defaultOut)
        self.server=None
        self.serverRunning=False
        self.converter=None
        self.timer=wx.Timer(self,1)
        self.Bind(wx.EVT_TIMER, self.OnTimer)
        self.timer.Start(500)
        pass

    def btExitClicked(self, event):
        self.terminateServer()
        self.terminateConverter()
        self.Close(True)

    def getBaseDir(self):
        dir=os.path.join(os.path.dirname(os.path.realpath(__file__)))
        return dir
    def doStartServer(self):
        if self.checkServerRunning():
            return
        script=os.path.join(self.getBaseDir(),"..","server","avnav_server.py")
        args=["xterm","-hold","-e",sys.executable,script,"-c",os.path.join(self.outputDir.GetValue(),"out"),os.path.join(self.getBaseDir(),"avnav_server.xml")]
        self.server=subprocess.Popen(args)
        self.checkServerRunning()

    def terminateServer(self):
        if self.server is not None:
            try:
                self.server.terminate()
            except:
                pass

    def checkServerRunning(self):
        if self.server is not None:
            try:
                if self.server.poll() is None:
                    #still running
                    if not self.serverRunning:
                        self.serverPid.SetLabel(str(self.server.pid))
                        self.serverPid.SetForegroundColour(wx.Colour(0,255, 0))
                        self.btStartServer.SetLabel("Stop Server")
                        self.serverRunning=True
                    return True
            except:
                try:
                    self.server.terminate()
                except:
                    pass
        #seems to be not running
        if self.serverRunning:
            self.serverPid.SetLabel("server stopped")
            self.serverPid.SetForegroundColour(wx.Colour(255,0, 0))
            self.btStartServer.SetLabel("Start Server")
            self.serverRunning=False
        return False

    def checkConverterRunning(self):
        if self.converter is not None:
            try:
                if self.converter.poll() is None:
                    return True
                #we stopped
                if self.startServer.IsChecked():
                    self.doStartServer()
                self.btStart.SetLabel("Start")
            except:
                self.btStart.SetLabel("Start")
                try:
                    self.converter.terminate()
                except:
                    pass
        self.converter=None
        return False
    def terminateConverter(self):
        if self.checkConverterRunning():
            try:
                self.converter.terminate()
            except:
                pass

    def btStartServerClicked(self, event):
        if self.serverRunning:
            self.terminateServer()
            self.checkServerRunning()
            return
        self.doStartServer()
    def OnTimer(self,evt):
        self.checkServerRunning()
        self.checkConverterRunning()

    def btSelectInputClicked(self, event):
        openFileDialog = wx.FileDialog(self, "Select Chart files or directories", "", "",
                                       "all (*.*)|*.*", wx.FD_OPEN | wx.FD_FILE_MUST_EXIST|wx.FD_MULTIPLE)

        if openFileDialog.ShowModal() == wx.ID_CANCEL:
            return     # the user changed idea...
        filenames=openFileDialog.GetPaths()
        for name in filenames:
            self.inputFiles.AppendText("\n"+name)

    def btEmptyClicked(self, event):
        self.inputFiles.Clear()

    def btStartClicked(self, event):
        if self.checkConverterRunning():
            self.terminateConverter()
            return
        files=re.split("\n",self.inputFiles.GetValue())
        selectedFiles=[]
        for f in files:
            if f != "":
                selectedFiles.append(f)
        if len(selectedFiles) < 1:
            wx.MessageBox("no files selected")
            return
        args=["xterm","-T","Avnav Chartconvert","-hold","-e",sys.executable,os.path.join(self.getBaseDir(),"..","chartconvert","read_charts.py"),"-b",self.outputDir.GetValue()]
        if self.updateMode.IsChecked():
            args.append("-f")
        for name in selectedFiles:
            args.append(name)
        self.converter=subprocess.Popen(args)
        self.btStart.SetLabel("Stop")
        self.checkConverterRunning()

    def btOutDefaultClicked(self, event):
        self.outputDir.SetValue(self.defaultOut)

    def btSelectOutClicked(self, event):
        openFileDialog = wx.DirDialog(self, "Select Output Dir", style=1,defaultPath=self.defaultOut)
        if openFileDialog.ShowModal() == wx.ID_CANCEL:
            return     # the user changed idea...
        self.outputDir.SetValue(openFileDialog.GetPath())




if __name__ == "__main__":
    app = wx.PySimpleApp(0)
    wx.InitAllImageHandlers()
    frame_1 = AvnavGui(None, -1, "")
    app.SetTopWindow(frame_1)
    frame_1.Show()
    app.MainLoop()
