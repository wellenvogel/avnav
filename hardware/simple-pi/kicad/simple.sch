EESchema Schematic File Version 4
EELAYER 30 0
EELAYER END
$Descr A4 11693 8268
encoding utf-8
Sheet 1 1
Title "Minimalistic AvNav pi setup"
Date "2020-07-06"
Rev "1"
Comp "wellenvogel"
Comment1 ""
Comment2 ""
Comment3 ""
Comment4 ""
$EndDescr
$Comp
L Connector:Screw_Terminal_01x02 J1
U 1 1 5F03334D
P 2900 2550
F 0 "J1" H 2818 2225 50  0000 C CNN
F 1 "Screw_Terminal" H 3100 2300 50  0000 C CNN
F 2 "" H 2900 2550 50  0001 C CNN
F 3 "~" H 2900 2550 50  0001 C CNN
	1    2900 2550
	-1   0    0    1   
$EndComp
$Comp
L modules:ModLM2596 U1
U 1 1 5F039799
P 4300 2400
F 0 "U1" H 4250 2500 50  0000 C CNN
F 1 "ModLM2596" H 4250 2350 50  0000 C CNN
F 2 "" H 4050 2400 50  0001 C CNN
F 3 "" H 4050 2400 50  0001 C CNN
	1    4300 2400
	1    0    0    -1  
$EndComp
Wire Wire Line
	3100 2550 3750 2550
Wire Wire Line
	3100 2450 3400 2450
Wire Wire Line
	3400 2450 3400 2250
Wire Wire Line
	3400 2250 3750 2250
Wire Wire Line
	4750 2250 5550 2250
Wire Wire Line
	5550 2250 5550 1650
$Comp
L Switch:SW_DPST_x2 SW2
U 1 1 5F057CD4
P 6300 4200
F 0 "SW2" V 6346 4112 50  0000 R CNN
F 1 "Switch" V 6255 4112 50  0000 R CNN
F 2 "" H 6300 4200 50  0001 C CNN
F 3 "" H 6300 4200 50  0001 C CNN
	1    6300 4200
	0    -1   -1   0   
$EndComp
Wire Wire Line
	4750 2550 4900 2550
Wire Wire Line
	4900 2550 4900 4600
Wire Wire Line
	4900 4600 5550 4600
Wire Wire Line
	6300 4000 6300 3800
Wire Wire Line
	6300 4400 6300 4600
Connection ~ 6300 4600
$Comp
L Switch:SW_Push SW1
U 1 1 5F06A77E
P 5850 4200
F 0 "SW1" V 5896 4152 50  0000 R CNN
F 1 "SW_Push" V 5805 4152 50  0000 R CNN
F 2 "" H 5850 4400 50  0001 C CNN
F 3 "" H 5850 4400 50  0001 C CNN
	1    5850 4200
	0    -1   -1   0   
$EndComp
Wire Wire Line
	5850 4400 5850 4600
Connection ~ 5850 4600
Wire Wire Line
	5850 4600 6300 4600
Wire Wire Line
	6300 3800 6950 3800
$Comp
L Connector:Raspberry_Pi_2_3 U3
U 1 1 5F02F835
P 7750 3100
F 0 "U3" H 8250 4550 50  0000 C CNN
F 1 "Raspberry_Pi_2_3" H 8350 4450 50  0000 C CNN
F 2 "" H 7750 3100 50  0001 C CNN
F 3 "https://www.raspberrypi.org/documentation/hardware/raspberrypi/schematics/rpi_SCH_3bplus_1p0_reduced.pdf" H 7750 3100 50  0001 C CNN
	1    7750 3100
	1    0    0    -1  
$EndComp
Wire Wire Line
	5850 4000 5850 2600
Wire Wire Line
	5850 2600 6950 2600
Wire Wire Line
	7350 4600 7350 4400
Wire Wire Line
	6300 4600 6800 4600
$Comp
L Device:Buzzer BZ1
U 1 1 5F09D4D1
P 5300 3400
F 0 "BZ1" H 5305 3075 50  0000 C CNN
F 1 "Buzzer" H 5305 3166 50  0000 C CNN
F 2 "" V 5275 3500 50  0001 C CNN
F 3 "~" V 5275 3500 50  0001 C CNN
	1    5300 3400
	-1   0    0    1   
$EndComp
Wire Wire Line
	5400 3300 6950 3300
Wire Wire Line
	5400 3500 5550 3500
Wire Wire Line
	5550 3500 5550 4600
Connection ~ 5550 4600
Wire Wire Line
	5550 4600 5850 4600
Wire Wire Line
	7650 1650 7650 1800
Wire Wire Line
	5550 1650 6800 1650
$Comp
L modules:ModUblox6 U2
U 1 1 5F0A1361
P 6250 2100
F 0 "U2" H 6267 2365 50  0000 C CNN
F 1 "ModUblox6" H 6267 2274 50  0000 C CNN
F 2 "" H 6250 2100 50  0001 C CNN
F 3 "" H 6250 2100 50  0001 C CNN
	1    6250 2100
	-1   0    0    -1  
$EndComp
Wire Wire Line
	6600 2200 6950 2200
Wire Wire Line
	6600 2300 6950 2300
Wire Wire Line
	6600 2400 6800 2400
Wire Wire Line
	6800 2400 6800 4600
Connection ~ 6800 4600
Wire Wire Line
	6800 4600 7350 4600
Wire Wire Line
	6600 2100 6800 2100
Wire Wire Line
	6800 2100 6800 1650
Connection ~ 6800 1650
Wire Wire Line
	6800 1650 7650 1650
$EndSCHEMATC
