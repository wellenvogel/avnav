package de.wellenvogel.avnav.worker;

import android.content.Context;
import android.content.SharedPreferences;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import android.os.SystemClock;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import net.sf.marineapi.nmea.parser.SentenceFactory;
import net.sf.marineapi.nmea.sentence.TalkerId;
import net.sf.marineapi.nmea.sentence.XDRSentence;
import net.sf.marineapi.nmea.util.Measurement;

import org.json.JSONException;
import org.json.JSONObject;

import java.io.IOException;
import java.util.Locale;

import de.wellenvogel.avnav.main.Constants;
import de.wellenvogel.avnav.main.R;
import de.wellenvogel.avnav.util.AvnLog;
import de.wellenvogel.avnav.util.AvnUtil;
import de.wellenvogel.avnav.util.NmeaQueue;

/**
 * Internal worker that reads the device orientation sensors and emits the
 * boat attitude (roll and pitch) as NMEA XDR transducer sentences
 * ($INXDR,..,A,D,ROLL,A,..,D,PITCH), so the Decoder automatically picks them
 * up as transducers.ROLL / transducers.PITCH.
 * The mounting is given by "screenFacing" (which way the device screen faces on the boat)
 * and measured by "calibrateMount" (boat level): the measured up axis makes it work for any
 * device rotation in the screen plane (portrait, landscape, ...) and for tilted mounts.
 * Without a calibration no data is emitted.
 * Positive roll = starboard down, positive pitch = bow up.
 */
public class AndroidAttitudeHandler extends ChannelWorker implements SensorEventListener {

    private static final String LOGPRFX = "Avnav:AndroidAttitudeHandler";
    private static final long EMIT_INTERVAL = 1000; // ms, 1 Hz (same rate class as GPS)
    private static final long LOOP_INTERVAL = 200;  // ms
    private static final long SENSOR_TIMEOUT = 3000; // ms without sensor events -> data is stale
    private static final String ROLL_TRANSDUCER_NAME = "ROLL";
    private static final String PITCH_TRANSDUCER_NAME = "PITCH";

    private static final EditableParameter.IntegerParameter PRIORITY_PARAMETER = SOURCE_PRIORITY_PARAMETER.clone(40);
    //opt-in: the rotation sensor costs battery and a loosely carried device would
    //produce meaningless roll/pitch, so do not enable by default
    private static final EditableParameter.BooleanParameter ENABLED_PARAMETER_OPT_IN = ENABLED_PARAMETER.clone(false);
    //default "aft": screen facing aft (towards the cockpit), i.e. the usual
    //upright mount with the viewer facing the bow
    private static final EditableParameter.StringListParameter SCREENFACING_PARAMETER =
            new EditableParameter.StringListParameter("screenFacing", R.string.labelSettingsAttitudeScreenFacing, "aft",
                    "aft", "bow", "port", "starboard");
    //only offered while enabled: a request stored while disabled would otherwise
    //silently calibrate at whatever attitude the boat has when enabled later
    private static final EditableParameter.BooleanParameter CALIBRATE_PARAMETER =
            new EditableParameter.BooleanParameter("calibrateMount", R.string.labelSettingsAttitudeCalibrateMount, false)
                    .cloneCondition(new AvnUtil.KeyValue<>(ENABLED_PARAMETER_OPT_IN.name, true));
    //written by calibrateMount: "<screenFacing>,<ux>,<uy>,<uz>" - the measured boat up axis
    //in device coordinates for the actual mount; only used while screenFacing still matches
    private static final EditableParameter.StringParameter MOUNT_CALIBRATION_PARAMETER =
            new EditableParameter.StringParameter("mountCalibration", R.string.labelSettingsAttitudeMountCalibration, "");
    //minimal sin of the angle between the screen normal and the measured up axis,
    //i.e. the screen may be tilted up to 60deg away from vertical (not lying flat)
    private static final double MIN_BOW_LEN = 0.5;

    private SensorManager sensorManager;
    private Sensor rotationSensor;  // attitude source: game rotation vector (gyro+accel, no magnetometer)
    private volatile boolean isRegistered = false;  // written in run() (worker thread), read in stop()
    private volatile float[] lastRotationMatrix = null;          // device->world rotation matrix
    private volatile long lastSensorEvent = 0;                   // uptime of the last rotation vector event
    private long lastEmit = 0;
    private long runStart = 0;                                    // uptime when run() started (grace period for calibrateMount)
    private static final String CALIBRATE_CHILD_STATUS = "calibrateMount";

    AndroidAttitudeHandler(String name, GpsService ctx, NmeaQueue queue) {
        super(name, ctx, queue);
        parameterDescriptions.addParams(
                ENABLED_PARAMETER_OPT_IN,
                SOURCENAME_PARAMETER,
                PRIORITY_PARAMETER,
                SCREENFACING_PARAMETER,
                CALIBRATE_PARAMETER,
                MOUNT_CALIBRATION_PARAMETER
        );
        status.canEdit = true;
    }

    /**
     * drop a calibrateMount request when the worker is disabled: the UI hides the
     * field then, but still submits its value (e.g. set and disabled in one edit)
     */
    @Override
    public synchronized void setParameters(String child, JSONObject newParam, boolean replace, boolean check) throws JSONException, IOException {
        super.setParameters(child, newParam, replace, check);
        if (!isEnabled() && CALIBRATE_PARAMETER.fromJson(parameters)) {
            JSONObject cleaned = new JSONObject(parameters.toString());
            cleaned.put(CALIBRATE_PARAMETER.name, false);
            parameters = cleaned; //atomic assignment, as in Worker.setParameters
        }
    }

    @Override
    public void onSensorChanged(@NonNull SensorEvent event) {
        if (event.sensor.getType() == Sensor.TYPE_GAME_ROTATION_VECTOR) {
            float[] r = new float[9];
            SensorManager.getRotationMatrixFromVector(r, event.values);
            lastRotationMatrix = r;
            lastSensorEvent = SystemClock.uptimeMillis();
        }
    }

    /**
     * true if no sensor event arrived within SENSOR_TIMEOUT
     */
    private boolean isSensorStale() {
        return SystemClock.uptimeMillis() - lastSensorEvent > SENSOR_TIMEOUT;
    }

    @Override
    public void onAccuracyChanged(@NonNull Sensor sensor, int accuracy) {
    }

    /**
     * the current rotation matrix or null if there is none or it is stale
     */
    private @Nullable float[] currentMatrix() {
        float[] r = lastRotationMatrix;
        if (r == null || isSensorStale()) return null;
        return r;
    }

    /**
     * the measured up axis stored by calibrateMount, or null if there is none, it is invalid
     * or it was taken for a different screenFacing
     */
    private @Nullable float[] calibratedUp() throws JSONException {
        String cal = MOUNT_CALIBRATION_PARAMETER.fromJson(parameters);
        if (cal == null || cal.trim().isEmpty()) return null;
        String[] parts = cal.split(",");
        if (parts.length != 4) return null;
        if (!parts[0].trim().equals(SCREENFACING_PARAMETER.fromJson(parameters))) return null;
        try {
            float[] u = new float[3];
            for (int i = 0; i < 3; i++) u[i] = Float.parseFloat(parts[i + 1].trim());
            double len = Math.sqrt(AttitudeMath.dot(u, u));
            if (len < 0.9 || len > 1.1) return null;
            return u;
        } catch (NumberFormatException e) {
            return null;
        }
    }

    /**
     * boat axes {F, U} for a measured up axis: the bow axis from screenFacing,
     * made perpendicular to up; null if not computable (screen lying flat)
     */
    private @Nullable float[][] boatAxes(float[] u) throws JSONException {
        float[] f0 = AttitudeMath.bowFromScreenFacing(SCREENFACING_PARAMETER.fromJson(parameters), u);
        float[] f = AttitudeMath.orthogonalBow(f0, u, MIN_BOW_LEN);
        if (f == null) return null;
        return new float[][]{f, u};
    }

    private void emitAttitude() throws JSONException {
        if (rotationSensor == null) {
            setStatus(WorkerStatus.Status.ERROR, "no rotation vector sensor");
            return;
        }
        if (lastRotationMatrix == null) {
            setStatus(WorkerStatus.Status.RUNNING, "waiting for sensor data");
            return;
        }
        float[] r = currentMatrix();
        if (r == null) {
            //sensor events stopped: do not keep emitting the last values
            setStatus(WorkerStatus.Status.ERROR, "no sensor data for " + (SENSOR_TIMEOUT / 1000) + "s");
            return;
        }
        float[] u = calibratedUp();
        if (u == null) {
            setStatus(WorkerStatus.Status.ERROR, "not calibrated: set calibrateMount with the boat level");
            return;
        }
        float[][] axes = boatAxes(u);
        if (axes == null) {
            setStatus(WorkerStatus.Status.ERROR, "invalid mountCalibration: calibrate again");
            return;
        }
        //0.1 deg is more than the sensor accuracy; keeps the XDR sentence short
        double roll = Math.round(AttitudeMath.computeRollDeg(r, axes[0], axes[1]) * 10) / 10.0;
        double pitch = Math.round(AttitudeMath.computePitchDeg(r, axes[0], axes[1]) * 10) / 10.0;
        XDRSentence xdr = (XDRSentence) SentenceFactory.getInstance().createParser(TalkerId.IN, "XDR");
        xdr.addMeasurement(new Measurement("A", roll, "D", ROLL_TRANSDUCER_NAME));
        xdr.addMeasurement(new Measurement("A", pitch, "D", PITCH_TRANSDUCER_NAME));
        queue.add(xdr.toSentence(), getSourceName(), getPriority(PRIORITY_PARAMETER));
        setStatus(WorkerStatus.Status.NMEA, String.format("roll=%.1f pitch=%.1f", roll, pitch));
        AvnLog.d(LOGPRFX, String.format("roll=%.1f pitch=%.1f", roll, pitch));
    }

    /**
     * apply the calibrateMount request (boat must be level): measure the boat up axis in device
     * coordinates for the actual mount and store it as mountCalibration, so that roll and pitch
     * are computed about the real boat axes.
     * calibrateMount is a one-shot request: if there is no valid attitude within
     * SENSOR_TIMEOUT after the start (setting the flag restarts the worker) or there
     * is no sensor at all, the flag is reset as well and the failure is shown in the status.
     */
    private synchronized void applyCalibration() throws JSONException, IOException {
        float[] r = currentMatrix();
        if (r == null) {
            boolean graceOver = SystemClock.uptimeMillis() - runStart > SENSOR_TIMEOUT;
            if (rotationSensor != null && !graceOver) {
                return; //wait for the first sensor data after the start
            }
            calibrationFailed("no valid sensor data");
            return;
        }
        float[] u = AttitudeMath.measuredUp(r);
        if (boatAxes(u) == null) {
            calibrationFailed("screen tilted too far from vertical (lying flat?)");
            return;
        }
        String cal = String.format(Locale.US, "%s,%.5f,%.5f,%.5f",
                SCREENFACING_PARAMETER.fromJson(parameters), u[0], u[1], u[2]);
        resetCalibrateFlag(cal);
        status.unsetChildStatus(CALIBRATE_CHILD_STATUS);
        AvnLog.i(LOGPRFX, "mount calibrated: " + cal);
    }

    private void calibrationFailed(String reason) throws JSONException, IOException {
        resetCalibrateFlag(null);
        status.setChildStatus(CALIBRATE_CHILD_STATUS, WorkerStatus.Status.ERROR, "failed: " + reason);
        AvnLog.i(LOGPRFX, "calibrateMount failed: " + reason);
    }

    /**
     * clear the calibrateMount flag (and store a new mountCalibration if not null) and
     * persist our config. Works on a copy that replaces the parameters as a whole (like
     * every other config change), so readers on other threads never see a half updated object.
     */
    private void resetCalibrateFlag(@Nullable String calibration) throws JSONException, IOException {
        JSONObject updated = new JSONObject(parameters.toString());
        updated.put(CALIBRATE_PARAMETER.name, false);
        if (calibration != null) updated.put(MOUNT_CALIBRATION_PARAMETER.name, calibration);
        setParameters(null, updated, true, false);
        SharedPreferences prefs = gpsService.getSharedPreferences(Constants.PREFNAME, Context.MODE_PRIVATE);
        prefs.edit().putString("internal." + getTypeName(), getConfig().toString()).commit();
        gpsService.updateConfigSequence();
    }

    @Override
    public void run(int startSequence) throws JSONException, IOException {
        //do not reuse values from a previous run (e.g. in applyCalibration after a restart)
        lastRotationMatrix = null;
        lastSensorEvent = 0;
        runStart = SystemClock.uptimeMillis();
        sensorManager = (SensorManager) gpsService.getSystemService(Context.SENSOR_SERVICE);
        rotationSensor = sensorManager == null ? null : sensorManager.getDefaultSensor(Sensor.TYPE_GAME_ROTATION_VECTOR);
        if (rotationSensor != null) {
            sensorManager.registerListener(this, rotationSensor, SensorManager.SENSOR_DELAY_UI); //events on the main thread
            isRegistered = true;
        }
        while (!shouldStop(startSequence)) {
            try {
                if (CALIBRATE_PARAMETER.fromJson(parameters)) {
                    applyCalibration();
                }
                long now = SystemClock.uptimeMillis();
                if (now - lastEmit >= EMIT_INTERVAL) {
                    emitAttitude();
                    lastEmit = now;
                }
            } catch (Throwable t) {
                AvnLog.e(LOGPRFX + ": error in attitude loop", t);
            }
            if (!sleep(LOOP_INTERVAL)) break;
        }
        //stop() may have run before we registered the listener above
        if (isRegistered) {
            sensorManager.unregisterListener(this);
            isRegistered = false;
        }
    }

    @Override
    public void stop() {
        if (isRegistered) {
            sensorManager.unregisterListener(this);
            isRegistered = false;
        }
        super.stop();
    }
}
