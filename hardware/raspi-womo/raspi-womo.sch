EESchema Schematic File Version 4
EELAYER 26 0
EELAYER END
$Descr A4 11693 8268
encoding utf-8
Sheet 1 1
Title ""
Date ""
Rev ""
Comp ""
Comment1 ""
Comment2 ""
Comment3 ""
Comment4 ""
$EndDescr
$Comp
L Connector:Raspberry_Pi_2_3 J?
U 1 1 5C7C1C85
P 5250 2950
F 0 "J?" H 5250 4428 50  0000 C CNN
F 1 "Raspberry_Pi_2_3" H 5250 4337 50  0000 C CNN
F 2 "" H 5250 2950 50  0001 C CNN
F 3 "https://www.raspberrypi.org/documentation/hardware/raspberrypi/schematics/rpi_SCH_3bplus_1p0_reduced.pdf" H 5250 2950 50  0001 C CNN
	1    5250 2950
	1    0    0    -1  
$EndComp
$Comp
L Generic:4Pin LM259612V/5V
U 1 1 5C7C269D
P 2250 2050
F 0 "LM259612V/5V" H 2000 1550 50  0000 C CNN
F 1 "--" H 1950 2374 50  0000 C CNN
F 2 "" H 2050 1750 50  0001 C CNN
F 3 "" H 2050 1750 50  0001 C CNN
	1    2250 2050
	1    0    0    -1  
$EndComp
Wire Wire Line
	2150 1950 2800 1950
Wire Wire Line
	2800 1950 2800 1350
Wire Wire Line
	2800 2150 2800 4500
Wire Wire Line
	2150 2150 2800 2150
Text Notes 1350 1950 0    50   ~ 0
+12V
Text Notes 1450 2150 0    50   ~ 0
0V\n
Text Notes 2400 1900 0    50   ~ 0
+5V
$Comp
L Generic:Ublox U?
U 1 1 5C7C3066
P 4250 3050
F 0 "U?" H 3804 3365 50  0000 C CNN
F 1 "Ublox" H 3804 3274 50  0000 C CNN
F 2 "" H 4050 2750 50  0001 C CNN
F 3 "" H 4050 2750 50  0001 C CNN
	1    4250 3050
	1    0    0    -1  
$EndComp
Wire Wire Line
	2800 1350 5150 1350
Wire Wire Line
	5150 1350 5150 1650
Wire Wire Line
	4850 4500 4850 4250
Wire Wire Line
	2800 4500 4850 4500
Wire Wire Line
	5050 1600 5050 1650
Wire Wire Line
	3650 3000 3250 3000
Wire Wire Line
	3250 3000 3250 1600
Wire Wire Line
	3250 1600 5050 1600
Wire Wire Line
	3750 3100 3350 3100
Wire Wire Line
	3350 3100 3350 2050
Wire Wire Line
	3350 2050 4450 2050
Wire Wire Line
	3650 3250 3450 3250
Wire Wire Line
	3450 3250 3450 2150
Wire Wire Line
	3450 2150 4450 2150
Wire Wire Line
	3650 3350 3450 3350
Wire Wire Line
	3450 3350 3450 4400
Wire Wire Line
	3450 4400 5050 4400
Wire Wire Line
	5050 4400 5050 4250
Text Notes 3350 1700 0    50   ~ 0
braun
Text Notes 3500 2000 0    50   ~ 0
schwarz
Text Notes 3550 2250 0    50   ~ 0
weiss\n
Text Notes 3500 3700 0    50   ~ 0
grau
Text Notes 3750 1300 0    50   ~ 0
lila
Text Notes 2950 4450 0    50   ~ 0
grau
Text Notes 1100 1950 0    50   ~ 0
braun
Text Notes 1150 2150 0    50   ~ 0
blau
$EndSCHEMATC
