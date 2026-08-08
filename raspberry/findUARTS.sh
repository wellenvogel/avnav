#!/bin/bash

# Parse options
VERBOSE=false
while getopts "d" opt; do
  case ${opt} in
    d ) VERBOSE=true ;;
    * ) echo "Usage: $0 [-d]" >&2; exit 1 ;;
  esac
done

if [ "$VERBOSE" = true ]; then
    echo "# =================================================="
    echo "# UART Discovery via /dev & udevadm (Debian Trixie)"
    echo "# =================================================="
fi

found_any=false

# 1. Scan active character device nodes directly in /dev
for dev_path in /dev/ttyAMA* /dev/ttyS*; do
    # Skip if no matching nodes are found
    [ -c "$dev_path" ] || continue
    
    TTY_NAME=$(basename "$dev_path")

    # 2. Query kernel properties using udevadm
    UDEV_PROPS=$(udevadm info --query=property --name="$dev_path" 2>/dev/null)
    
    # 3. FILTER 1: Is it explicitly claimed by the Bluetooth/serdev driver?
    if echo "$UDEV_PROPS" | grep -qE "ID_NET_DRIVER=bcm|ID_BUS=serdev|SUBSYSTEM=bluetooth"; then
        [ "$VERBOSE" = true ] && echo "# Skipping $dev_path (Blocked by Bluetooth/Serdev subsystem rules)"
        continue
    fi

    # 4. FILTER 2: Check if the raw kernel device path contains Bluetooth signatures
    DEV_PATH_PROP=$(echo "$UDEV_PROPS" | grep "^DEVPATH=" | cut -d'=' -f2)
    if [[ "$DEV_PATH_PROP" == *"bluetooth"* || "$DEV_PATH_PROP" == *"hci0"* ]]; then
        [ "$VERBOSE" = true ] && echo "# Skipping $dev_path (Path contains active Bluetooth/HCI reference)"
        continue
    fi

    # 5. FILTER 3: Primary controller hardware assignment override
    # On Raspberry Pi models, if ttyAMA0 is the hardware port wired to the internal BT chip
    # and the system has an active hci0 stack initialized, we safely mask it out.
    if [ "$TTY_NAME" = "ttyAMA0" ]; then
        if [ -d "/sys/class/bluetooth/hci0" ]; then
            [ "$VERBOSE" = true ] && echo "# Skipping $dev_path (Hardware channel allocated to default hci0 interface)"
            continue
        fi
    fi

    # 6. Output the verified non-Bluetooth ports
    if [ "$VERBOSE" = true ]; then
        echo "$dev_path"
        echo "#   -> Kernel DEVPATH: $DEV_PATH_PROP"
        ID_BUS_INFO=$(echo "$UDEV_PROPS" | grep "^ID_BUS=" | cut -d'=' -f2)
        [ -n "$ID_BUS_INFO" ] && echo "#   -> Bus Type:       $ID_BUS_INFO"
        echo "# --------------------------------------------------"
    else
        # Standard clean output mode
        echo "$dev_path"
    fi
    found_any=true
done

if [ "$found_any" = false ] && [ "$VERBOSE" = true ]; then
    echo "# No available platform UART devices found outside of Bluetooth."
fi

