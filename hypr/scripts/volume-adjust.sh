#!/bin/bash
# Replaces swayosd-client: does the actual volume change, then flags the
# waybar sound/brightness module to show a temporary level indicator instead
# of a floating bottom-center OSD.
#
# Always targets the ThinkPad's own speakers, regardless of whether the
# Philips monitor is connected — its DDC/CI speaker volume was tried and
# rejected (low audio quality, and DDC's 0-100 range has no equivalent to
# wpctl's 125% soft-boost). See brightness.sh for the monitor-vs-laptop
# routing pattern; audio intentionally does not use it.
case "$1" in
    raise)       wpctl set-volume -l 1.25 @DEFAULT_AUDIO_SINK@ 5%+ ;;
    lower)       wpctl set-volume @DEFAULT_AUDIO_SINK@ 5%- ;;
    mute-toggle) wpctl set-mute @DEFAULT_AUDIO_SINK@ toggle ;;
esac

date +%s%3N > /tmp/audio-trigger
pkill -RTMIN+8 waybar 2>/dev/null
