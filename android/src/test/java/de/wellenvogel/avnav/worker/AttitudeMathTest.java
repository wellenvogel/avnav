package de.wellenvogel.avnav.worker;

import org.junit.Test;

import static org.junit.Assert.*;

public class AttitudeMathTest {

    private static final double DELTA = 1e-6;

    @Test
    public void bowFromScreenFacing() {
        float[] top = {0, 1, 0};   // up: top edge (portrait)
        float[] right = {1, 0, 0}; // up: right edge (landscape)
        //screen facing aft/bow: bow axis is the screen normal, independent of the device rotation
        assertArrayEquals(new float[]{0, 0, -1}, AttitudeMath.bowFromScreenFacing("aft", top), 0.001f);
        assertArrayEquals(new float[]{0, 0, 1}, AttitudeMath.bowFromScreenFacing("bow", top), 0.001f);
        assertArrayEquals(new float[]{0, 0, -1}, AttitudeMath.bowFromScreenFacing("aft", right), 0.001f);
        //screen facing starboard, top up: right edge (+x) points to the bow
        assertArrayEquals(new float[]{1, 0, 0}, AttitudeMath.bowFromScreenFacing("starboard", top), 0.001f);
        //screen facing port, top up: left edge (-x) points to the bow
        assertArrayEquals(new float[]{-1, 0, 0}, AttitudeMath.bowFromScreenFacing("port", top), 0.001f);
        //screen facing starboard, right edge up: bottom edge (-y) points to the bow (top edge points aft)
        assertArrayEquals(new float[]{0, -1, 0}, AttitudeMath.bowFromScreenFacing("starboard", right), 0.001f);
        //perpendicular to up for an upright screen
        for (String facing : new String[]{"aft", "bow", "port", "starboard"}) {
            assertEquals(0.0, AttitudeMath.dot(AttitudeMath.bowFromScreenFacing(facing, top), top), 1e-6);
        }
        assertNull(AttitudeMath.bowFromScreenFacing("up", top));
        assertNull(AttitudeMath.bowFromScreenFacing(null, top));
        assertNull(AttitudeMath.bowFromScreenFacing("aft", null));
    }

    /**
     * build a row-major device->world rotation matrix for a rotation of deg
     * about the given world axis (only x and y needed for the tests)
     */
    private static float[] rotX(double deg) {
        double r = Math.toRadians(deg);
        double c = Math.cos(r), s = Math.sin(r);
        return new float[]{1, 0, 0, 0, (float) c, (float) -s, 0, (float) s, (float) c};
    }

    private static float[] rotY(double deg) {
        double r = Math.toRadians(deg);
        double c = Math.cos(r), s = Math.sin(r);
        return new float[]{(float) c, 0, (float) s, 0, 1, 0, (float) -s, 0, (float) c};
    }

    @Test
    public void rollZeroWhenUpright() {
        // device==boat, bow = +x, up = +z, identity rotation
        float[] F = {1, 0, 0};
        float[] U = {0, 0, 1};
        assertEquals(0.0, AttitudeMath.computeRollDeg(new float[]{1, 0, 0, 0, 1, 0, 0, 0, 1}, F, U), DELTA);
    }

    @Test
    public void rollPositiveToStarboardDown() {
        // bow = +x, up = +z; rotation about +x by +10deg lowers the starboard side
        float[] F = {1, 0, 0};
        float[] U = {0, 0, 1};
        assertEquals(10.0, AttitudeMath.computeRollDeg(rotX(10), F, U), 1e-4);
        assertEquals(-10.0, AttitudeMath.computeRollDeg(rotX(-10), F, U), 1e-4);
    }

    @Test
    public void rollWithBowAlongY() {
        // bow = +y, up = +z; rotation about +y by +10deg is starboard down
        float[] F = {0, 1, 0};
        float[] U = {0, 0, 1};
        assertEquals(10.0, AttitudeMath.computeRollDeg(rotY(10), F, U), 1e-4);
        assertEquals(-10.0, AttitudeMath.computeRollDeg(rotY(-10), F, U), 1e-4);
    }

    @Test
    public void rollSignFlipsWithBowDirection() {
        // same physical rotation, but bow defined as -x: roll sign must flip
        float[] F = {-1, 0, 0};
        float[] U = {0, 0, 1};
        assertEquals(-10.0, AttitudeMath.computeRollDeg(rotX(10), F, U), 1e-4);
    }

    @Test
    public void pitchZeroWhenLevel() {
        float[] F = {1, 0, 0};
        float[] U = {0, 0, 1};
        assertEquals(0.0, AttitudeMath.computePitchDeg(new float[]{1, 0, 0, 0, 1, 0, 0, 0, 1}, F, U), DELTA);
    }

    @Test
    public void pitchPositiveBowUp() {
        // bow = +x, up = +z; rotation about +y by -10deg raises the bow
        float[] F = {1, 0, 0};
        float[] U = {0, 0, 1};
        assertEquals(10.0, AttitudeMath.computePitchDeg(rotY(-10), F, U), 1e-4);
        assertEquals(-10.0, AttitudeMath.computePitchDeg(rotY(10), F, U), 1e-4);
    }

    private static float[] mul(float[] A, float[] B) {
        float[] rt = new float[9];
        for (int i = 0; i < 3; i++)
            for (int j = 0; j < 3; j++)
                for (int k = 0; k < 3; k++)
                    rt[i * 3 + j] += A[i * 3 + k] * B[k * 3 + j];
        return rt;
    }

    @Test
    public void rollAndPitchDecoupledWhenCombined() {
        // bow = +x, up = +z; combined rotation: pitch 10deg bow up + roll 20deg starboard down
        float[] F = {1, 0, 0};
        float[] U = {0, 0, 1};
        float[] R = mul(rotY(-10), rotX(20));
        assertEquals(20.0, AttitudeMath.computeRollDeg(R, F, U), 1e-4);
        assertEquals(10.0, AttitudeMath.computePitchDeg(R, F, U), 1e-4);
    }

    @Test
    public void measuredUpIsWorldUpInDeviceCoords() {
        // identity: device up == world up
        assertArrayEquals(new float[]{0, 0, 1},
                AttitudeMath.measuredUp(new float[]{1, 0, 0, 0, 1, 0, 0, 0, 1}), 1e-6f);
        // device rotated 30deg about y: world up seen from the device leans towards -x
        float[] u = AttitudeMath.measuredUp(rotY(30));
        assertEquals(Math.sin(Math.toRadians(-30)), u[0], 1e-6);
        assertEquals(0.0, u[1], 1e-6);
        assertEquals(Math.cos(Math.toRadians(30)), u[2], 1e-6);
    }

    @Test
    public void orthogonalBow() {
        float[] up = {0, 0, 1};
        // already perpendicular: unchanged
        assertArrayEquals(new float[]{1, 0, 0}, AttitudeMath.orthogonalBow(new float[]{1, 0, 0}, up, 0.5), 1e-6f);
        // tilted bow: the up component is removed and the result normalized
        float[] f = AttitudeMath.orthogonalBow(new float[]{1, 0, 1}, up, 0.5);
        assertArrayEquals(new float[]{1, 0, 0}, f, 1e-6f);
        // bow (nearly) parallel to up: not computable
        assertNull(AttitudeMath.orthogonalBow(new float[]{0.1f, 0, 1}, up, 0.5));
        assertNull(AttitudeMath.orthogonalBow(null, up, 0.5));
    }

    /**
     * device mounted tilted by 30deg about the athwartship axis (e.g. a bulkhead leaning back):
     * with the axes calibrated at rest via measuredUp/orthogonalBow, roll and pitch must be
     * exact for any heel - a fixed angle offset would give 22.8deg roll and 2deg pitch here
     */
    @Test
    public void calibratedTiltedMountIsExact() {
        float[] fNominal = {1, 0, 0};
        float[] mount = rotY(30); // device->world with the boat level
        float[] u = AttitudeMath.measuredUp(mount);
        float[] f = AttitudeMath.orthogonalBow(fNominal, u, 0.5);
        assertNotNull(f);
        // at rest: zero
        assertEquals(0.0, AttitudeMath.computeRollDeg(mount, f, u), 1e-4);
        assertEquals(0.0, AttitudeMath.computePitchDeg(mount, f, u), 1e-4);
        // boat heels 20deg starboard down (rotation about the world bow axis x)
        float[] heeled = mul(rotX(20), mount);
        assertEquals(20.0, AttitudeMath.computeRollDeg(heeled, f, u), 1e-3);
        assertEquals(0.0, AttitudeMath.computePitchDeg(heeled, f, u), 1e-3);
        // boat pitches 10deg bow up
        float[] pitched = mul(rotY(-10), mount);
        assertEquals(0.0, AttitudeMath.computeRollDeg(pitched, f, u), 1e-3);
        assertEquals(10.0, AttitudeMath.computePitchDeg(pitched, f, u), 1e-3);
    }

    /**
     * device in landscape (right edge up), screen facing starboard, mounted tilted 20deg
     * (screen facing slightly up): calibrated axes give exact roll/pitch
     */
    @Test
    public void calibratedLandscapeStarboard() {
        // device->world at rest: right edge (+x) up, screen (+z) to starboard (world -y),
        // bottom edge (-y) to the bow (world +x); then the screen tilted 20deg upwards
        float[] square = {0, -1, 0, 0, 0, -1, 1, 0, 0};
        float[] mount = mul(rotX(-20), square);
        float[] u = AttitudeMath.measuredUp(mount);
        float[] f = AttitudeMath.orthogonalBow(AttitudeMath.bowFromScreenFacing("starboard", u), u, 0.5);
        assertNotNull(f);
        assertEquals(0.0, AttitudeMath.computeRollDeg(mount, f, u), 1e-3);
        assertEquals(0.0, AttitudeMath.computePitchDeg(mount, f, u), 1e-3);
        assertEquals(15.0, AttitudeMath.computeRollDeg(mul(rotX(15), mount), f, u), 1e-3);
        assertEquals(5.0, AttitudeMath.computePitchDeg(mul(rotY(-5), mount), f, u), 1e-3);
    }

    /**
     * device lying flat (screen up): the bow axis cannot be derived from screenFacing
     */
    @Test
    public void flatDeviceNotCalibratable() {
        float[] up = {0, 0, 1};
        for (String facing : new String[]{"aft", "bow", "port", "starboard"}) {
            assertNull(facing, AttitudeMath.orthogonalBow(AttitudeMath.bowFromScreenFacing(facing, up), up, 0.5));
        }
    }
}
