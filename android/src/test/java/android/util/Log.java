package android.util;

/** JVM test replacement for Android's logging backend. */
public final class Log {
    private Log() {}

    public static int d(String tag, String message) {
        return print(tag, message, null);
    }

    public static int d(String tag, String message, Throwable error) {
        return print(tag, message, error);
    }

    public static int i(String tag, String message) {
        return print(tag, message, null);
    }

    public static int w(String tag, String message) {
        return print(tag, message, null);
    }

    public static int e(String tag, String message) {
        return print(tag, message, null);
    }

    public static int e(String tag, String message, Throwable error) {
        return print(tag, message, error);
    }

    private static int print(String tag, String message, Throwable error) {
        System.err.println(tag + ": " + message);
        if (error != null) error.printStackTrace(System.err);
        return 0;
    }
}
