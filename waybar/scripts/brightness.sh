#!/bin/bash

DEVICE="amdgpu_bl1"
MAX=64764

current=$(brightnessctl -d $DEVICE g)
percent=$(( current * 100 / MAX ))

echo "${percent}%"
