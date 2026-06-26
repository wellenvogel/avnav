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
        iconClass: iconClasses.AddonConfigPlus,
        name:btdef.AddonConfigPlus,
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
    ReloadUI:{
        iconClass: iconClasses.Reload,
        name:btdef.ReloadUI,
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
    AisInfoLocate:{
        iconClass: iconClasses.Center,
        name:btdef.AisInfoLocate,
    },
    AisInfoHide:{
        iconClass: iconClasses.AisInfoHide,
        name:btdef.AisInfoHide,
    },
    //channels
    StatusAdd:{
        iconClass: iconClasses.StatusAdd,
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
    //center the map to the current waypoint
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
    NavSelectChart:{
        iconClass: iconClasses.SelectChart,
        name:btdef.NavSelectChart,
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
        iconClass: iconClasses.NavToCenter,
        name:btdef.NavToCenter,
    },
    //start a route
    NavGoto:{
        iconClass: iconClasses.NavGoto,
        name: btdef.NavGoto,
    },
    //skip the current target and go to the next target of the route
    NavNext:{
        iconClass: iconClasses.NavNext,
        name:btdef.NavNext,
    },
    //restart the routing to the current target (route)
    NavRestart:{
        iconClass: iconClasses.NavGoto,
        name: btdef.NavRestart,
    },
    //restart the routing to the current target (wp)
    WpRestart:{
        iconClass: iconClasses.WpRestart,
        name:btdef.WpRestart,
    },
    //stop the routing of a route
    StopNav:{
        iconClass: iconClasses.NavStop,
        name:btdef.StopNav
    },
    //stop waypoint routing
    StopWp:{
        iconClass: iconClasses.WpStop,
        name:btdef.StopWp
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
    StopAnchorWatch:{
        iconClass: iconClasses.AnchorEnd,
        name:btdef.StopAnchorWatch,
    },
    LockPos:{
        iconClass: iconClasses.LockPos,
        name:btdef.LockPos,
    },
    //start a waypoint routing to the current map center
    //also in feature info
    WpGoto:{
        iconClass: iconClasses.WpGoto,
        name:btdef.WpGoto,
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
    NavActions:{
        iconClass: iconClasses.Navigation,
        name:btdef.NavActions,
    },
    ABShowWpButtons:{
        iconClass: iconClasses.Waypoint,
        name:btdef.ABShowWpButtons
    },
    ABShowMeasure:{
        iconClass:iconClasses.Measure,
        name:btdef.ABShowMeasure,
    },
    Measure:{
        iconClass: iconClasses.Measure,
        name:btdef.Measure,
    },
    MeasureAdd:{
        iconClass: iconClasses.MeasureAdd,
        name:btdef.MeasureAdd,
    },
    MeasureOff:{
        iconClass: iconClasses.MeasureOff,
        name:btdef.MeasureOff,
    },
    ToRoute:{
        iconClass: iconClasses.Route,
        name:btdef.ToRoute,
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
        iconClass: iconClasses.RouteAdd,
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
        iconClass: iconClasses.StatusRestart,
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
    EditLayout:{
        iconClass: iconClasses.Layout,
        name:btdef.EditLayout,
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
    },

    DBOk:{
        iconClass: iconClasses.Ok,
        name:btdef.DBOk,
    },
    DBCancel:{
        iconClass: iconClasses.Cancel,
        name:btdef.DBCancel,
    },
    DBDownload:{
        iconClass: iconClasses.Download,
        name:btdef.DBDownload,
    },
    DBRename:{
        iconClass: iconClasses.Edit,
        name:btdef.DBRename,
    },
    DBDelete:{
        iconClass: iconClasses.Delete,
        name:btdef.DBDelete,
    },
    DBSaveAs:{
        iconClass: iconClasses.SaveAs,
        name:btdef.DBSaveAs
    },
    DBSave:{
        iconClass: iconClasses.Save,
        name:btdef.DBSave,
    },
    DBAdd:{
        iconClass: iconClasses.Plus,
        name:btdef.DBAdd,
    },
    DBNew:{
      iconClass: iconClasses.Plus,
      name:btdef.DBNew,
    },
    DBReload:{
        iconClass: iconClasses.Reload,
        name:btdef.DBReload,
    },
    DBDisable:{
        iconClass: iconClasses.Disable,
        name:btdef.DBDisable,
    },
    DBIgnore:{
        name:btdef.DBIgnore,
    },
    DBEmptyRoute:{
        iconClass: iconClasses.EmptyRoute,
        name:btdef.DBEmptyRoute,
    },
    DBInvertRoute:{
        iconClass: iconClasses.InvertRoute,
        name:btdef.DBInvertRoute
    },
    DBRenumberRoute:{
        iconClass: iconClasses.RenumberRoute,
        name:btdef.DBRenumberRoute,
    },
    DBNewRoute:{
        iconClass: iconClasses.Plus,
        name:btdef.DBNewRoute
    }  ,
    DBLoadRoute:{
        iconClass: iconClasses.Open,
        name:btdef.DBLoadRoute,
    },
    DBRoutePoints:{
        iconClass: iconClasses.Route,
        name:btdef.DBRoutePoints,
    },
    DBWpaRemove:{
        iconClass: iconClasses.Delete,
        name:btdef.DBRemove,
    },
    DBWpaEnable:{
        iconClass: iconClasses.Wifi,
        name:btdef.DBEnable
    },
    DBWpaDisable:{
        iconClass: iconClasses.WifiOff,
        name:btdef.DBDisable
    },
    DBWpaConnect:{
        iconClass: iconClasses.WpaConnect,
        name:btdef.DBConnect,
    },
    //Anchor
    DBAnchorBoat:{
        iconClass: iconClasses.Boat,
        name:btdef.DBAnchorBoat,
    },
    DBAnchorCenter:{
        iconClass: iconClasses.Center,
        name:btdef.DBAnchorCenter,
    },
    //general
    DBReset:{
        iconClass: iconClasses.Reset,
        name: btdef.DBReset,
    },
    DBClear:{
        iconClass: iconClasses.Delete,
        name:btdef.DBClear,
    },
    //Chart select
    DBShowOverlays:{
        iconClass: iconClasses.Overlays,
        name:btdef.DBShowOverlays,
    },
    DBHideOverlays:{
        iconClass: iconClasses.HideOverlays,
        name:btdef.DBHideOverlays
    },
    //edit overlays
    DBShowAllOverlays:{
        iconClass: iconClasses.Overlays,
        name:btdef.DBShowAllOverlays,
    },
    DBHideAllOverlays:{
        iconClass: iconClasses.HideOverlays,
        name:btdef.DBHideAllOverlays,
    },
    DBInsertBefore:{
        iconClass: iconClasses.Before,
        name:btdef.DBInsertBefore,
    },
    DBInsertAfter:{
        iconClass: iconClasses.After,
        name:btdef.DBInsertAfter,
    },
    //combined widget
    DBAddSub:{
        iconClass: iconClasses.Plus,
        name:btdef.DBAddSub,
    },
    //edit dialog
    DBPreview:{
        iconClass: iconClasses.View,
        name:btdef.DBPreview,
    },
    //edit widget dialog
    DBBefore:{
        iconClass: iconClasses.Before,
        name:btdef.DBBefore,
    },
    DBAfter:{
        iconClass: iconClasses.After,
        name:btdef.DBAfter,
    },
    DBInsert:{
        iconClass: iconClasses.After,
        name:btdef.DBInsert,
    },
    DBUpdate:{
        iconClass: iconClasses.Ok,
        name:btdef.DBUpdate,
    },
    //eula
    DBAccept:{
        iconClass: iconClasses.Ok,
        name:btdef.DBAccept,
    },
    //importer
    DBStop:{
        iconClass: iconClasses.Stop,
        name:btdef.DBStop,
    },
    DBRestart:{
        iconClass: iconClasses.Reload,
        name:btdef.DBRestart,
    },
    DBLog:{
        iconClass: iconClasses.Log,
        name:btdef.DBLog,
    },
    //name dialog
    DBPropose:{
        iconClass: iconClasses.Propose,
        name:btdef.DBPropose,
    },
    //layout finishes
    DBEditCss:{
        iconClass: iconClasses.Edit,
        name:btdef.DBEditCss,
    },
    DBDiscard:{
        iconClass: iconClasses.Delete,
        name:btdef.DBDiscard,
    },
    //log dialog
    DBAutoReload:{
        name:btdef.DBAutoReload,
        iconClass: iconClasses.Reload,
    },
    //remote channel
    DBDisconnect:{
        iconClass: iconClasses.Disconnect,
        name:btdef.DBDisconnect,
    },
    DBConnect:{
        iconClass: iconClasses.Connect,
        name:btdef.DBConnect,
    },
    //select layout
    DBEditLayout:{
        iconClass: iconClasses.Layout,
        name:btdef.DBEditLayout
    },
    //track convert
    DBCompute:{
        iconClass: iconClasses.Start,
        name:btdef.DBCompute,
    },
    //chart actions
    DBOpenChart:{
        iconClass: iconClasses.Charts,
        name:btdef.DBOpen,
    },
    DBScheme:{
        iconClass: iconClasses.ChartScheme,
        name:btdef.DBScheme
    },
    DBOverlays:{
        iconClass: iconClasses.Overlays,
        name:btdef.DBOverlays
    },
    DBCopy:{
        iconClass: iconClasses.Copy,
        name:btdef.DBCopy,
    },
    DBView:{
        iconClass: iconClasses.View,
        name:btdef.DBView,
    },
    DBConfig:{
        iconClass: iconClasses.Edit,
        name:btdef.DBConfig,
    },
    DBActivate:{
        iconClass: iconClasses.Open,
        name:btdef.DBActivate,
    },
    DBUserApp:{
        iconClass: iconClasses.AddOns,
        name:btdef.DBUserApp
    },
    //Lock Dialog
    DBCurrent:{
        iconClass: iconClasses.Boat,
        name:btdef.DBCurrent,
    },
    //feature actions
    DBFeatureNewRoute:{
        iconClass: iconClasses.Route,
        name:btdef.DBFeatureNewRoute
    },
    DBCenter:{
        iconClass: iconClasses.Center,
        name:btdef.DBCenter,
    },
    DBEditRoute:{
        iconClass: iconClasses.Route,
        name:btdef.Edit
    },
    DBCleanTrack:{
        iconClass: iconClasses.Delete,
        name:btdef.DBCleanTrack,
    },
    DBInfo:{
        iconClass: iconClasses.Info,
        name:btdef.DBInfo,
    },
    DBHide:{
        iconClass: iconClasses.Hide,
        name:btdef.DBHide,
    },
    DBShow:{
        iconClass: iconClasses.View,
        name:btdef.DBShow,
    },
    DBInsertRouteBefore:{
        iconClass: iconClasses.NavAdd,
        name:btdef.DBInsertRouteBefore,
    },
    DBInsertRouteAfter:{
        iconClass: iconClasses.NavAddAfter,
        name:btdef.DBInsertRouteAfter,
    },
    DBStartRoute:{
        iconClass: iconClasses.NavGoto,
        name:btdef.DBStartRoute

    },
    DBColor:{
        iconClass: iconClasses.Color,
        name:btdef.DBColor
    }



}
export default ButtonDefinitions;

export const CL_BUTTON_TEXT = 'button-text';
export const CL_MAINBT_TEXT = 'main-button-text';