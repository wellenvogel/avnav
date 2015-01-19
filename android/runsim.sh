#! /bin/sh
set -x
#/usr/local/android-sdk-linux/tools/emulator -avd AVD_for_7_WSVGA_Tablet_Edited_by_User_1 -netspeed full -netdelay none -qemu -m 2047 -enable-kvm
#/usr/local/android-sdk-linux/tools/emulator -avd AVD_for_GoogleApi-5-x86-64_by_User -netspeed full -netdelay none -qemu -m 2047 -enable-kvm
/usr/local/android-sdk-linux/tools/emulator -avd AVD_for_GoogleApi_5_x86_64_by_User -netspeed full -netdelay none -qemu -m 2047 -enable-kvm

