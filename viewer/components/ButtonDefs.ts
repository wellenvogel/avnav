/**
 * # Copyright (c) 2012-2025 Andreas Vogel andreas@wellenvogel.net
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
 #  THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHERtime
 #  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 #  FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
 #  DEALINGS IN THE SOFTWARE.
 #
 */
// @ts-ignore
import * as btdef from '../style/button_text.less';
import {iconClasses} from './Icons';

/**
 * list of all used buttons
 * the key should be similar to the name used in button_text.less
 * technically not really necessary - but avoids confusion
 * to allow the ide and webpack to do static checks we cannot use the
 * syntax [btdef.XXX] for the keys
 */
const ButtonDefinitions= {
    MOB:{
        name:btdef.MOB,
        iconClass: iconClasses.MOB,
    },
    Cancel:{
        name:btdef.Cancel,
        iconClass: iconClasses.Cancel,
    },
    //addonconfig
    AddonConfigAddOns:{
        name:btdef.AddonConfigAddOns,
        iconClass: iconClasses.AddOns,
    },
    AddonConfigUser:{
        name:btdef.AddonConfigUser,
        iconClass: iconClasses.User,
    },
    AddonConfigImages:{
        name: btdef.AddonConfigImages,
        iconClass: iconClasses.Images,
    },
    AddonConfigPlus:{
        iconClass: iconClasses.Plus,
        name:btdef.AddonConfigPlus,
    },
    AddonConfigView:{
        iconClass: iconClasses.View,
        name:btdef.AddonConfigView,
    },
    //addonpage
    Back:{
        iconClass: iconClasses.Back,
        name:btdef.Back,
    },
    //general
    ServerView:{
        iconClass: iconClasses.Server,
        name:btdef.ServerView,
    },
    ShowSettings:{
        iconClass: iconClasses.Settings,
        name:btdef.ShowSettings,
    },
    Upload:{
        iconClass: iconClasses.Upload,
        name:btdef.Upload,
    },
    Dim:{
        iconClass: iconClasses.Dim,
        name:btdef.Dim,
    },
    //actions
    Night:{
        iconClass: iconClasses.Night,
        name:btdef.Night,
    },
    RemoteChannel:{
        iconClass: iconClasses.RemoteChannel,
        name:btdef.RemoteChannel,
    },
    FullScreen:{
        iconClass: iconClasses.FullScreen,
        name:btdef.FullScreen,
    },
    Split:{
        iconClass: iconClasses.Split,
        name:btdef.Split,
    },
    Reload:{
        iconClass: iconClasses.Reload,
        name:btdef.Reload,
    },
    MainExit:{
        iconClass: iconClasses.Cancel,
        name:btdef.MainExit,
    },
    //aispage
    AisNearest:{
        iconClass: iconClasses.AisNearest,
        name: btdef.AisNearest,
    },
    AisSort:{
        iconClass: iconClasses.Sort,
        name: btdef.AisSort,
    },
    AisLock:{
        iconClass: iconClasses.Lock,
        name: btdef.AisLock,
    },
    AisSearch:{
        iconClass: iconClasses.Search,
        name:btdef.AisSearch,
    },
    AisItems:{
        iconClass: iconClasses.Items,
        name:btdef.AisItems,
    },
    //channels
    StatusAdd:{
        iconClass: iconClasses.Plus,
        name:btdef.StatusAdd,
    },
    //charts
    ChartsView:{
        iconClass: iconClasses.Charts,
        name:btdef.ChartsView,
    },
    ImportsView:{
        iconClass: iconClasses.Imports,
        name:btdef.ImportsView,
    },
    OverlaysView:{
        iconClass: iconClasses.Overlays,
        name: btdef.OverlaysView
    },
    //nav/editroute
    WpLocate:{
        iconClass: iconClasses.WpLocate,
        name:btdef.WpLocate,
    },
    WpEdit:{
        iconClass: iconClasses.Edit,
        name: btdef.WpEdit,
    },
    WpNext:{
        iconClass: iconClasses.WpNext,
        name:btdef.WpNext,
    },
    WpPrevious:{
        iconClass: iconClasses.WpPrevious,
        name:btdef.WpPrevious,
    },
    NavOverlays:{
        iconClass: iconClasses.SelectChart,
        name:btdef.NavOverlays,
    },
    ZoomIn:{
        iconClass: iconClasses.ZoomIn,
        name:btdef.ZoomIn,
    },
    ZoomOut:{
        iconClass: iconClasses.ZoomOut,
        name:btdef.ZoomOut,
    },
    NavAddAfter:{
        iconClass: iconClasses.NavAddAfter,
        name:btdef.NavAddAfter,
    },
    NavAdd:{
        iconClass: iconClasses.NavAdd,
        name:btdef.NavAdd,
    },
    NavDelete:{
        iconClass: iconClasses.NavDelete,
        name:btdef.NavDelete,
    },
    NavToCenter:{
        iconClass: iconClasses.WpLocate,
        name:btdef.NavToCenter,
    },
    NavGoto:{
        iconClass: iconClasses.NavGoto,
        name: btdef.NavGoto,
    },
    NavNext:{
        iconClass: iconClasses.NavNext,
        name:btdef.NavNext,
    },
    WpGoto:{
        iconClass: iconClasses.WpGoto,
        name:btdef.WpGoto,
    },
    NavRestart:{
        iconClass: iconClasses.WpGoto,
        name: btdef.NavRestart,
    },
    StopNav:{
        iconClass: iconClasses.NavStop,
        name:btdef.StopNav
    },
    RouteMenu:{
        iconClass: iconClasses.RouteMenu,
        name:btdef.RouteMenu,
    },
    CenterAction:{
        iconClass: iconClasses.CenterAction,
        name:btdef.CenterAction,
    },
    AnchorWatch:{
        iconClass: iconClasses.Anchor,
        name:btdef.AnchorWatch,
    },
    LockPos:{
        iconClass: iconClasses.LockPos,
        name:btdef.LockPos,
    },
    LockMarker:{
        iconClass: iconClasses.LockMarker,
        name:btdef.LockMarker,
    },
    CourseUp:{
        iconClass: iconClasses.CourseUp,
        name:btdef.CourseUp,
    },
    ShowRoutePanel:{
        iconClass: iconClasses.Route,
        name: btdef.ShowRoutePanel,
    },
    GpsCenter:{
        iconClass: iconClasses.Center,
        name:btdef.GpsCenter,
    },
    //dashboard
    Gps1:{
        iconClass: iconClasses.Num1,
        name:btdef.Gps1,
    },
    Gps2:{
        iconClass: iconClasses.Num2,
        name:btdef.Gps2,
    },
    Gps3:{
        iconClass: iconClasses.Num3,
        name:btdef.Gps3,
    },
    Gps4:{
        iconClass: iconClasses.Num4,
        name:btdef.Gps4,
    },
    Gps5:{
        iconClass: iconClasses.Num5,
        name:btdef.Gps5,
    },
    Gps6:{
        iconClass: iconClasses.Num6,
        name:btdef.Gps6,
    },
    Gps7:{
        iconClass: iconClasses.Num7,
        name:btdef.Gps7,
    },
    Gps8:{
        iconClass: iconClasses.Num8,
        name:btdef.Gps8,
    },
    Gps9:{
        iconClass: iconClasses.Num9,
        name:btdef.Gps9,
    },
    Gps10:{
        iconClass: iconClasses.Num10,
        name:btdef.Gps10,
    },
    //main nav
    MainNav:{
        iconClass: iconClasses.MainNav,
        name:btdef.MainNav,
    },
    //routes page
    RouteAdd:{
        iconClass: iconClasses.Plus,
        name:btdef.RouteAdd,
    },
    SyncRoutes:{
        iconClass: iconClasses.Sync,
        name:btdef.SyncRoutes
    },
    Connected:{
        iconClass: iconClasses.Connected,
        name:btdef.Connected,
    },
    StoredRoutes:{
        iconClass: iconClasses.Items,
        name:btdef.StoredRoutes,
    },
    //server page
    MainInfo:{
        iconClass: iconClasses.Info,
        name:btdef.MainInfo,
    },
    StatusAll:{
        iconClass: iconClasses.Expand,
        name:btdef.StatusAll,
    },
    StatusWpa:{
        iconClass: iconClasses.Wifi,
        name:btdef.StatusWpa,
    },
    StatusAddresses:{
        iconClass: iconClasses.QRCode,
        name:btdef.StatusAddresses,
    },
    StatusAndroid:{
        iconClass: iconClasses.Android,
        name:btdef.StatusAndroid,
    },
    AndroidBrowser:{
        iconClass: iconClasses.Browser,
        name:btdef.AndroidBrowser,
    },
    StatusShutdown:{
        iconClass: iconClasses.Shutdown,
        name:btdef.StatusShutdown,
    },
    StatusRestart:{
        iconClass: iconClasses.Reload,
        name:btdef.StatusRestart,
    },
    StatusLog:{
        iconClass: iconClasses.Log,
        name:btdef.StatusLog,
    },
    StatusDebug:{
        iconClass: iconClasses.Debug,
        name:btdef.StatusDebug,
    },
    //settings
    SectionView:{
        iconClass: iconClasses.Section,
        name:btdef.SectionView,
    },
    SettingsItems:{
        iconClass: iconClasses.Items,
        name:btdef.SettingsItems,
    },
    SettingsDefaults:{
        iconClass: iconClasses.Reset,
        name:btdef.SettingsDefaults,
    },
    SettingsLoad:{
        iconClass: iconClasses.Open,
        name:btdef.SettingsLoad,
    },
    SettingsSave:{
        iconClass: iconClasses.Save,
        name:btdef.SettingsSave,
    },
    SettingsSplitReset:{
        iconClass: iconClasses.SplitReset,
        name:btdef.SettingsSplitReset,
    },
    SettingsLayoutOff:{
        iconClass: iconClasses.LayoutOff,
        name:btdef.SettingsLayoutOff
    },
    //tracks
    TrackItems:{
        iconClass: iconClasses.Items,
        name:btdef.TrackItems,
    },
    //layout editing
    Layout:{
        iconClass: iconClasses.Layout,
        name:btdef.Layout,
    },
    EditPage:{
        iconClass: iconClasses.EditPage,
        name: btdef.EditPage,
    },
    LayoutFinished:{
      iconClass: iconClasses.Layout,
        name:btdef.LayoutFinished,
    },
    RevertLayout:{
      iconClass: iconClasses.Undo,
      name:btdef.RevertLayout,
    },
    NavMapWidgets:{
        iconClass: iconClasses.NavMapWidgets,
        name: btdef.NavMapWidgets,
    },
    //other
    Help:{
        iconClass: iconClasses.Help,
        name:btdef.Help,
    },
    DefaultValue:{
        iconClass: iconClasses.Reset,
        name:btdef.DefaultValue,
    },
    Edit:{
        iconClass: iconClasses.Edit,
        name:btdef.Edit,
    },
    CreateFile:{
        iconClass: iconClasses.Plus,
        name:btdef.CreateFile,
    },
    Overflow:{
        iconClass: iconClasses.Overflow,
        name:btdef.Overflow,
    }
}
export default ButtonDefinitions;
export const CL_BUTTON_TEXT = 'button-text';
export const CL_MAINBT_TEXT = 'main-button-text';