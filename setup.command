#!/usr/bin/env bash

# Get the directory where this script is located
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

echo "==================================================="
echo "              MeetReaper Setup                     "
echo "==================================================="
echo ""
echo "Attempting to launch Google Chrome with the extension loaded..."

# Launch a new instance of Chrome with the extension loaded
open -n -a "Google Chrome" --args --load-extension="$DIR"

echo ""
echo "Note: If Chrome was already running, this might just open a new window."
echo "To permanently install it for daily use:"
echo "1. Open Chrome and go to chrome://extensions"
echo "2. Turn on 'Developer mode' in the top right"
echo "3. Click 'Load unpacked' and select this folder: "
echo "   $DIR"
echo ""
echo "You can close this window now."
