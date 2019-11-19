/**
 * Created by andreas on 04.05.14.
 */
import Toast,{hideToast} from '../components/Toast.jsx';
/**
 *
 * @param html the html to display
 * @param time time to show, 500 default
 * @param opt_callback if set will be called back on click
 */
const Overlay={};
Overlay.Toast=Toast;
Overlay.hideToast=hideToast;

module.exports=Overlay;