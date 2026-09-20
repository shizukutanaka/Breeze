# Homebrew Cask for Breeze Messenger
# Install: brew install --cask breeze-messenger
# Submit to: https://github.com/Homebrew/homebrew-cask
#
# After building .dmg, update url, sha256, and version.

cask "breeze-messenger" do
  version "3.5.0"
  sha256 "" # UPDATE after build

  url "https://github.com/shizukutanaka/breeze/releases/download/v#{version}/Breeze-#{version}.dmg"
  name "Breeze"
  desc "P2P Encrypted Messenger"
  homepage "https://github.com/shizukutanaka/breeze"

  livecheck do
    url :url
    strategy :github_latest
  end

  app "Breeze.app"

  zap trash: [
    "~/Library/Application Support/breeze-desktop",
    "~/Library/Preferences/com.breeze.messenger.plist",
    "~/Library/Caches/com.breeze.messenger",
  ]
end
