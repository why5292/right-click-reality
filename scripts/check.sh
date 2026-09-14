#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
mkdir -p .build /private/tmp/right-click-reality-module-cache
node --check backend/server.mjs
node --check backend/lib.mjs
node --test backend/test/*.test.mjs
swiftc -module-cache-path /private/tmp/right-click-reality-module-cache \
    ios/RightClickReality/Core/Models.swift \
    ios/RightClickReality/Core/Geometry.swift \
    scripts/CoreChecks.swift -o .build/core-checks
.build/core-checks
swiftc -typecheck -module-cache-path /private/tmp/right-click-reality-module-cache \
    ios/RightClickReality/Core/Models.swift \
    ios/RightClickReality/Services/AnalysisService.swift
swiftc -frontend -parse ios/RightClickReality/*.swift ios/RightClickReality/Core/*.swift \
    ios/RightClickReality/Services/*.swift ios/RightClickReality/Views/*.swift
plutil -lint ios/RightClickReality/Info.plist ios/RightClickReality.xcodeproj/project.pbxproj
