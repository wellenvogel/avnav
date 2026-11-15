package de.wellenvogel.avnav.worker;

/**
 * Pure math helpers for computing boat attitude (roll and pitch) from the device
 * orientation sensors. No Android dependencies so it can be unit tested on the JVM.
 * Device coordinate system (Android): x to the right of the screen, y towards
 * the top of the screen, z out of the screen.
 * Boat frame: F = forward (bow), S = starboard, U = up, with F x S = -U (i.e. S = F x U).
 * Sign conventions (same as SignalK / NMEA 2000): positive roll = starboard side down,
 * positive pitch = bow up.
 */
class AttitudeMath {

    /**
     * derive the (approximate) bow axis in device coords from the direction the
     * screen faces (boat frame) and the measured up axis U:
     * screen normal +z faces "aft" => -z, "bow" => +z,
     * "starboard" => U x z, "port" => z x U.
     * Not normalized and not necessarily perpendicular to U (tilted screen):
     * use {@link #orthogonalBow} to get the exact unit bow axis F.
     * @return the axis or null for unknown values
     */
    public static float[] bowFromScreenFacing(String facing, float[] up) {
        if (facing == null || up == null) return null;
        float[] z = {0, 0, 1};
        switch (facing) {
            case "bow": return z;
            case "aft": return new float[]{0, 0, -1};
            case "starboard": return cross(up, z);
            case "port": return cross(z, up);
            default: return null;
        }
    }

    public static float[] cross(float[] a, float[] b) {
        return new float[]{
                a[1] * b[2] - a[2] * b[1],
                a[2] * b[0] - a[0] * b[2],
                a[0] * b[1] - a[1] * b[0]
        };
    }

    public static float dot(float[] a, float[] b) {
        return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    }

    // R (row-major 3x3) times vector v
    private static float[] mul(float[] R, float[] v) {
        return new float[]{
                R[0] * v[0] + R[1] * v[1] + R[2] * v[2],
                R[3] * v[0] + R[4] * v[1] + R[5] * v[2],
                R[6] * v[0] + R[7] * v[1] + R[8] * v[2]
        };
    }

    private static final float[] WORLD_UP = {0, 0, 1};

    /**
     * the measured up direction in device coords: R^T * worldUp, i.e. the third row
     * of the row-major device->world matrix R. Taken with the boat level this is the
     * exact boat up axis U for the actual (possibly tilted) mount.
     */
    public static float[] measuredUp(float[] R) {
        return new float[]{R[6], R[7], R[8]};
    }

    /**
     * make a nominal bow axis perpendicular to up: F = normalize(F0 - (F0.U) U).
     * Removes the tilt of the mount from the bow axis (U must be a unit vector).
     * @param minLen minimal length of the projection before normalizing
     *               (sin of the angle between F0 and U); below that the mount is too far
     *               off the configured screenFacing (or lying flat) to derive a bow axis
     * @return the unit bow axis or null if not computable
     */
    public static float[] orthogonalBow(float[] f0, float[] up, double minLen) {
        if (f0 == null || up == null) return null;
        float d = dot(f0, up);
        float[] f = {f0[0] - d * up[0], f0[1] - d * up[1], f0[2] - d * up[2]};
        double len = Math.sqrt(dot(f, f));
        if (len < minLen) return null;
        return new float[]{(float) (f[0] / len), (float) (f[1] / len), (float) (f[2] / len)};
    }

    /**
     * Compute the roll angle.
     *
     * @param R 3x3 row-major device-to-world rotation matrix as returned by
     *          SensorManager.getRotationMatrixFromVector (world: z up; the horizontal
     *          axes have an arbitrary heading for the game rotation vector - only z is used)
     * @param F unit vector in device coords pointing towards the bow
     * @param U unit vector in device coords pointing up (must be perpendicular to F)
     * @return roll in degrees, positive = starboard down
     */
    public static double computeRollDeg(float[] R, float[] F, float[] U) {
        // boat up and forward in world coords; roll is the tilt of the up vector
        // about the *current* forward axis, so it stays exact even when pitched
        float[] uw = mul(R, U);
        float[] fw = mul(R, F);
        float[] c = cross(fw, WORLD_UP);
        return Math.toDegrees(Math.atan2(dot(uw, c), dot(uw, WORLD_UP)));
    }

    /**
     * Compute the pitch angle with the same inputs as {@link #computeRollDeg}.
     *
     * @return pitch in degrees, positive = bow up
     */
    public static double computePitchDeg(float[] R, float[] F, float[] U) {
        // elevation of the bow above the horizon; independent of roll
        float[] fw = mul(R, F);
        double s = dot(fw, WORLD_UP);
        if (s > 1) s = 1;
        if (s < -1) s = -1;
        return Math.toDegrees(Math.asin(s));
    }
}
