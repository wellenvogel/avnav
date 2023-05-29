#! /usr/bin/env python3

import gi
import os
import subprocess
import threading
import sys
import time
import traceback
import Xlib
from Xlib.display import Display
from Xlib import X
import re

gi.require_version("Gtk", "3.0")
from gi.repository import Gtk,Gdk,GdkPixbuf,Gio,GObject,GLib,GdkX11

#XLib stuff
def getProp(disp,win, prop):
    if disp is None:
        disp=Display()
    p = win.get_full_property(disp.intern_atom(prop), 0)
    return [None] if (p is None) else p.value
def listWindows(root):
    children = root.query_tree().children
    for window in children:
        yield window
    for window in children:
        for window in listWindows(window):
            yield window

def findWindowByPid(pid):
    disp = Display()
    xroot = disp.screen().root
    for window in listWindows(xroot):
        attrs=window.get_attributes()
        if attrs is None or attrs.map_state != Xlib.X.IsViewable:
            continue
        PIDs=getProp(disp,window,'_NET_WM_PID')
        if PIDs is None or len(PIDs) < 1:
            continue
        if PIDs[0] != pid:
            continue
        name=window.get_wm_name()
        window.change_attributes(event_mask=Xlib.X.PropertyChangeMask)
        return window




TITLE_CHECK=re.compile('AVNav-Web')

BASE_RESOLUTION=160.0
SIZE=48 #at 160 dpi gives ~ 7mm
MARGIN=SIZE+4*SIZE/10
BASE_DIR="/usr/lib/avnav/viewer/images"

def getScale(original,resolution):
    return int(original*resolution/BASE_RESOLUTION)
def getImage(name,baseDir=None,resolution=160):
    if baseDir is None:
        baseDir=BASE_DIR
    imgpath=os.path.join(baseDir,name)
    if not os.path.exists(imgpath):
        raise Exception("image %s not found"%imgpath)
    scaledSize=getScale(SIZE,resolution)
    pb=GdkPixbuf.Pixbuf.new_from_file_at_scale(imgpath,scaledSize,scaledSize,True)
    img=Gtk.Image()
    img.set_from_pixbuf(pb)
    return img

#GTK based...

class ResetDialog(Gtk.Dialog):
    def __init__(self, parent):
        super().__init__(title="Reset UI", transient_for=parent, flags=0)
        self.add_buttons(
            Gtk.STOCK_CANCEL, Gtk.ResponseType.CANCEL, Gtk.STOCK_OK, Gtk.ResponseType.OK
        )

        self.set_default_size(250, 100)
        label = Gtk.Label(label="Ready to reset the AvNav UI?")
        box = self.get_content_area()
        box.add(label)
        self.show_all()

class BDef():
    def __init__(self,action,icon,toTarget=True,command=None) -> None:
        self.action=action
        self.icon=icon
        self.command=command
        self.iconBase=None
        self.toTarget=toTarget
    def run(self,*args):
        if self.command is None:
            return
        self.command(self.action,self.toTarget)
    def getImage(self,baseDir=None,resolution=160):
        if baseDir is None:
            baseDir=self.iconBase
        return getImage(self.icon,baseDir,resolution)    



BUTTONS=[
    BDef(['Escape','ctrl+w'],'ic_clear.svg'), #close
    BDef('ctrl+bracketleft','ic_arrow_back.svg'), #back
    BDef('ctrl+bracketright','ic_arrow_forward.svg'), #forward
    BDef('F5','ic_refresh.svg'), #reload
    BDef('Super_L+2','rpi.png',toTarget=False),
    BDef('##restart','RedBubble40.png')
]

class ButtonList():
    def __init__(self,callback,buttons=BUTTONS,iconBase=None) -> None:
        self.buttons=buttons
        self.callback=callback
        for button in self.buttons:
            if iconBase is not  None:
                button.iconBase=iconBase
            if button.command is None:
                button.command=callback

class ButtonWindow(Gtk.Window):
    POS_RIGHT=0
    POS_LEFT=1
    def mapped_cb(self,*args):
        self.setPosition()
        self.setStruts()

    def __init__(self,buttonList: ButtonList,lr:int=POS_RIGHT):
        super().__init__(title="FF-Panel")
        self.resolution=self.get_screen().get_resolution()
        self.set_border_width(getScale(SIZE/10,self.resolution))
        self.lr=lr
        self.curgeo=None

        hbox = Gtk.Box(spacing=6,orientation=Gtk.Orientation.VERTICAL)
        self.add(hbox)
        for bdef in buttonList.buttons:
            button = Gtk.Button()
            button.connect("clicked", bdef.run)
            button.set_image(bdef.getImage(resolution=self.resolution))
            hbox.pack_start(button, False, False, 0)
        self.connect('map-event',self.mapped_cb)    


    def setPanelParam(self):
        self.set_decorated(False)
        self.set_role('Panel')
        self.set_type_hint(Gdk.WindowTypeHint.DOCK)
    

    def setPosition(self):
        screen=self.get_screen()
        display = screen.get_display()
        scaledMargin=getScale(MARGIN,self.resolution)
        scaledSize=getScale(SIZE,self.resolution)
        
        self.curgeo=display.get_monitor_at_window(self.get_window()).get_geometry()
        '''
        print("monitor %d x %d (offset x=%d, y=%d)" % (self.curgeo.width,
                                                                    self.curgeo.height,
                                                                    self.curgeo.x,
                                                                    self.curgeo.y))
        print("bar: right=%d" % (self.curgeo.x+self.curgeo.width-1))
        '''

        # display bar left/right
        if self.lr == self.POS_LEFT:
            self.move(self.curgeo.x,self.curgeo.y)
        else:
            #self.move(20,20)    
            #gravity does not work???
            self.move(self.curgeo.x+self.curgeo.width-scaledMargin-1,self.curgeo.y)
        self.resize(scaledSize,self.curgeo.height)
        
    #https://gist.github.com/johnlane/351adff97df196add08aGLib.OptionFlags.NONE
    def setStruts(self):
        if self.curgeo is None:
            raise Exception("curgeo not set")
        display = Display()
        topw = display.create_resource_object('window',
                                          self.get_window().get_xid())

        # http://python-xlib.sourceforge.net/doc/html/python-xlib_21.html#SEC20
        struts=None
        if self.lr == self.POS_LEFT:
            struts=[getScale(MARGIN,self.resolution)+1, 0, 0, 0,   self.curgeo.y, self.curgeo.y+self.curgeo.height-1, 0, 0, 0, 0, 0, 0]
        else:
            struts=[0, getScale(MARGIN,self.resolution)+1, 0, 0,   0, 0, self.curgeo.y, self.curgeo.y+self.curgeo.height-1, 0, 0, 0, 0]    
        res=topw.change_property(display.intern_atom('_NET_WM_STRUT_PARTIAL'),
                           display.intern_atom('CARDINAL'), 32,
                           struts,
                           X.PropModeReplace) 
        display.flush()


class MyApp(Gtk.Application):
    def __init__(self, *args, **kwargs):
        super().__init__(
            *args,
            flags=Gio.ApplicationFlags.HANDLES_COMMAND_LINE,
            **kwargs
        )
        self.add_main_option(
            'class',
            ord('c'),
            GLib.OptionFlags.NONE,
            GLib.OptionArg.STRING,
            "GTK application class",
            None
        )
        self.add_main_option(
            'pid',
            ord('p'),
            GLib.OptionFlags.NONE,
            GLib.OptionArg.INT,
            'Target pid to send keystrokes',
            None
        )
        self.add_main_option(
            'base',
            ord('b'),
            GLib.OptionFlags.NONE,
            GLib.OptionArg.STRING,
            'base dir for icons',
            None
        )
        self.add_main_option(
            'dialog',
            ord('d'),
            GLib.OptionFlags.NONE,
            GLib.OptionArg.NONE,
            'reset dialog only',
            None
        )
        self.window = None
        self.targetPid=None
        self.targetWindow=None
        self.buttonlist=None
        self.iconBase=None
        self.dialogOnly=False
    def do_command_line(self, command_line):
        options = command_line.get_options_dict()
        # convert GVariantDict -> GVariant -> dict
        options = options.end().unpack()
        if 'class' in options:
            Gdk.set_program_class(options['class'])
        if 'pid' in options:
            self.targetPid=options['pid']
        if 'base' in options:
            self.iconBase=options['base']
        if 'dialog' in options:
            self.dialogOnly=True
        if not self.dialogOnly:    
            self.buttonlist=ButtonList(self.handle_action,iconBase=self.iconBase)    
        self.activate()
    def eventHandler(self,ev):
        if self.targetWindow is not None:
            try:
                w=ev.get_window()
                xid=w.get_xid() if w is not None else None
                if xid == self.targetWindow.id:
                    #print("evhandler", ev.get_event_type(),xid)
                    if ev.get_event_type() == Gdk.EventType.PROPERTY_NOTIFY:
                        #print("property notify...")
                        if ev.property.atom.name()=='_NET_WM_NAME':
                            self.handleTargetVisibility()
            except Exception as e:
                print("ERR:",e)
        Gtk.main_do_event(ev)    
    def do_activate(self):
        if self.dialogOnly:
            self.window=Gtk.Window()
            self.reset_dialog()
            self.quit()
        if self.window is None:
            self.window = ButtonWindow(self.buttonlist)
            self.window.setPanelParam()
            self.window.connect("destroy", self.quit)
        self.window.show_all()
        self.add_window(self.window)
        Gdk.event_handler_set(self.eventHandler)
        if self.targetPid is not None:
            if self.findTarget:
                GLib.timeout_add(1000,self.findTarget)
            
    def findTarget(self):
        targetWindow=findWindowByPid(self.targetPid)
        if targetWindow is not None:
            self.targetWindow=targetWindow
            d=self.window.get_screen().get_display()
            tw=GdkX11.X11Window.foreign_new_for_display(d,self.targetWindow.id)
            tw.set_events(Gdk.EventMask.PROPERTY_CHANGE_MASK)
            self.handleTargetVisibility()
            return False
        return True
    def handleTargetVisibility(self):
        if self.targetWindow is None:
            self.window.show()
            return True
        name=getProp(None,self.targetWindow,'_NET_WM_NAME')
        if TITLE_CHECK.match(name.decode('utf-8',errors='ignore')):
            self.window.hide()
            return False
        else:
            self.window.show()
            return True
    def error_dialog(self,error):
        dialog = Gtk.MessageDialog(
            transient_for=self.window,
            flags=0,
            message_type=Gtk.MessageType.ERROR,
            buttons=Gtk.ButtonsType.CANCEL,
            text=error,
        )
        dialog.run()
        dialog.destroy()
    def reset_dialog(self):
        dialog = ResetDialog(self.window)
        response = dialog.run()
        dialog.destroy()
        if response == Gtk.ResponseType.OK:
            cmd=[os.path.join(os.path.dirname(__file__),'resetUI.sh')]
            if not os.path.exists(cmd[0]):
                self.error_dialog("%s not found"%cmd[0])
                return
            res=subprocess.run(cmd)
            if res.returncode != 0:
                self.error_dialog("running %s failed with status %d"%(cmd[0],res.returncode))

    def handle_action(self,key,toTarget=True):
        if key[0:1] == '#':
            if key == '##restart':
                self.reset_dialog()
                return
        if self.targetWindow is None and toTarget:
            return
        if not isinstance(key,list):
            key=[key]
        cmd=[]
        if toTarget:    
            cmd=["xdotool","windowactivate","--sync",str(self.targetWindow.id),"key"]
        else:
            cmd=["xdotool","key","--clearmodifiers"]    
        cmd.extend(key)    
        res=subprocess.run(cmd)
        if res.returncode != 0:
            print("%s failed with %d"%(" ".join(cmd),res.returncode))
    
        


try:
    app=MyApp()
    app.run(sys.argv)
except:
    print(traceback.format_exc())
    sys.exit(1)
print("run finished...")