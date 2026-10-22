# Documentation: Universal Onboard Wi-Fi Renaming for Raspberry Pi (3 to 5)

This document describes the final, completely conflict-free approach for assigning a unique, predictable device name (e.g., `mywifi0`) to the built-in Wi-Fi adapter across all common Raspberry Pi models (Pi 3, 4, 5, Zero W/2W, and Compute Modules 3/4/5) running modern Linux distributions (such as **Debian Trixie** and `systemd` v257+).

---

## 1. The Universal, Conflict-Free Solution

To eliminate naming conflicts caused by virtual interfaces (e.g., during simultaneous Access Point operations) or external USB adapters featuring Broadcom chipsets, this configuration combines the specific kernel driver of the onboard chip (`Driver=brcmfmac`) with explicit interface type and hardware path exclusions.

Create or overwrite the following configuration file:

**File Path:** `/etc/systemd/network/10-onboard-wifi.link`

```ini
[Match]
# 1. Targets the specific Broadcom/Cypress/Infineon FullMAC driver used by all onboard Pi chips
Driver=brcmfmac

# 2. Restricts the match to Wi-Fi interfaces (ignoring the chip's Bluetooth endpoints)
Type=wlan

# 3. Matches only the primary client interface (prevents conflicts with virtual AP/P2P interfaces)
WLANInterfaceType=station

# 4. Categorically excludes external USB Wi-Fi dongles carrying Broadcom chips
Path=!*usb*

[Link]
Name=mywifi0
```

---

## 2. Why These Advanced Criteria Are Necessary

* **Protection Against AP/Hotspot Naming Conflicts (`WLANInterfaceType=station`):** When networking software (such as `hostapd`, `iwd`, or `NetworkManager`) spawns a second, virtual wireless interface for a hotspot or Wi-Fi Direct session (e.g., type `ap` or `p2p`), a native driver-only rule would attempt to rename *both* interfaces to the exact same string (`mywifi0`). This results in a critical udev naming collision. Restricting the match to `station` ensures only the primary client interface gets renamed. Virtual hotspot interfaces cleanly fall back to default patterns (e.g., `uap0` or `wlan1`) without breaking system execution.
* **No Interference from USB Dongles (`Path=!*usb*`):** If an external USB Wi-Fi dongle using a Broadcom chipset (and thus relying on the `brcmfmac` driver) is plugged into the Pi, the inverted path rule (`!*usb*`) forces udev to skip it entirely.
* **Independence from Kernel Path Variations:** Older path-based patterns (`Path=platform-*.mmc`) fail under the Raspberry Pi 5's new bus architecture and newer `systemd` versions (v257+) running on the Pi 4 due to missing or mutated `ID_PATH` allocations. This driver- and functional type-based approach circumvents all platform discrepancies.

---

## 3. Technical Overview & Verification

The udev evaluation rules have been successfully tested and verified across the following environments:

| Raspberry Pi Variant | Onboard Wi-Fi Chip | Kernel Driver | Systemd Behavior (Debian Trixie) |
| :--- | :--- | :--- | :--- |
| **Pi 3 / 3B+ / Zero W / CM3** | Broadcom BCM43438 / BCM43455 | `brcmfmac` | Successfully assigned via driver matching |
| **Pi 4 / 4B / Zero 2W / CM4** | Cypress CYW43455 | `brcmfmac` | Successfully assigned (Bypasses missing `ID_PATH` issues) |
| **Pi 5 / CM5** | Infineon CYW55573 | `brcmfmac` | Successfully assigned via AXI bus abstraction |

---

## 4. Activating Changes on Live Systems

To apply this configuration immediately without forcing a full system reboot:

```bash
# 1. Reload the udev configuration layer
sudo udevadm control --reload

# 2. Trigger the rule explicitly for the network subsystem
sudo udevadm trigger --subsystem-match=net
```

### Verification via Terminal
You can verify the successful matching condition with the following diagnostic command:
```bash
udevadm test-builtin net_setup_link /sys/class/net/wlan0
```
*Expected Output:* `wlan0: Config file /etc/systemd/network/10-onboard-wifi.link is applied`
