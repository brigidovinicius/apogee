#!/bin/sh
set -eu
if [ "${1:-}" != '--keyring-session' ]; then
  exec dbus-run-session -- /bin/sh "$0" --keyring-session "$@"
fi
shift
test -s /run/apogee/keyring-password
umask 077
mkdir -p /tmp/apogee-keyring
export GNOME_KEYRING_CONTROL=/tmp/apogee-keyring
gnome-keyring-daemon --unlock --components=secrets --control-directory="$GNOME_KEYRING_CONTROL" \
  </run/apogee/keyring-password >/dev/null
exec "$@"
