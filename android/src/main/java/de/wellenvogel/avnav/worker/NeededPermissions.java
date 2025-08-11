package de.wellenvogel.avnav.worker;

public class NeededPermissions {
    public static enum Mode{
        UNCHANGED,
        NEEDED,
        NOT_NEEDED
    }
    public Mode bluetooth=Mode.UNCHANGED;
    public Mode gps=Mode.UNCHANGED;
}
