#!/usr/bin/env python3
"""Generate the checked-in Xcode project without XcodeGen or third-party packages."""
import hashlib
import json
from pathlib import Path

root = Path(__file__).resolve().parents[1]
ios = root / 'ios'
project_dir = ios / 'RightClickReality.xcodeproj'
project_dir.mkdir(parents=True, exist_ok=True)

def uid(label):
    return hashlib.sha256(label.encode()).hexdigest()[:24].upper()

def q(value):
    return json.dumps(str(value), ensure_ascii=False)

records = []
def add(label, body):
    records.append(f'\t\t{uid(label)} = {{ {body} }};')
    return uid(label)

sources = sorted((ios / 'RightClickReality').rglob('*.swift'))
refs = []
builds = []
for source in sources:
    rel = source.relative_to(ios / 'RightClickReality').as_posix()
    ref = add('file:' + rel, f'isa = PBXFileReference; lastKnownFileType = sourcecode.swift; name = {q(source.name)}; path = {q(rel)}; sourceTree = "<group>";')
    refs.append(ref)
    builds.append(add('build:' + rel, f'isa = PBXBuildFile; fileRef = {ref};'))

info = add('info', 'isa = PBXFileReference; lastKnownFileType = text.plist.xml; path = Info.plist; sourceTree = "<group>";')
config = add('baseconfig', 'isa = PBXFileReference; lastKnownFileType = text.xcconfig; path = Base.xcconfig; sourceTree = "<group>";')
local = add('localconfig', 'isa = PBXFileReference; lastKnownFileType = text.xcconfig; path = Local.xcconfig; sourceTree = "<group>";')
product = add('product', 'isa = PBXFileReference; explicitFileType = wrapper.application; includeInIndex = 0; path = RightClickReality.app; sourceTree = BUILT_PRODUCTS_DIR;')
sources_group = add('sourcesgroup', 'isa = PBXGroup; children = (' + ','.join(refs + [info]) + ',); path = RightClickReality; sourceTree = "<group>";')
config_group = add('configgroup', f'isa = PBXGroup; children = ({config},{local},); path = Configuration; sourceTree = "<group>";')
products_group = add('productsgroup', f'isa = PBXGroup; children = ({product},); name = Products; sourceTree = "<group>";')
main_group = add('maingroup', f'isa = PBXGroup; children = ({sources_group},{config_group},{products_group},); sourceTree = "<group>";')
sources_phase = add('sourcesphase', 'isa = PBXSourcesBuildPhase; buildActionMask = 2147483647; files = (' + ','.join(builds) + ',); runOnlyForDeploymentPostprocessing = 0;')
frameworks_phase = add('frameworksphase', 'isa = PBXFrameworksBuildPhase; buildActionMask = 2147483647; files = (); runOnlyForDeploymentPostprocessing = 0;')
resources_phase = add('resourcesphase', 'isa = PBXResourcesBuildPhase; buildActionMask = 2147483647; files = (); runOnlyForDeploymentPostprocessing = 0;')

project_configs = []
target_configs = []
for name in ['Debug', 'Release']:
    settings = 'CLANG_ENABLE_MODULES = YES; CLANG_ENABLE_OBJC_ARC = YES; SDKROOT = iphoneos; IPHONEOS_DEPLOYMENT_TARGET = 16.0; SWIFT_VERSION = 5.0; '
    settings += 'SWIFT_OPTIMIZATION_LEVEL = "-Onone"; DEBUG_INFORMATION_FORMAT = dwarf; ONLY_ACTIVE_ARCH = YES;' if name == 'Debug' else 'SWIFT_OPTIMIZATION_LEVEL = "-O"; DEBUG_INFORMATION_FORMAT = "dwarf-with-dsym";'
    project_configs.append(add('projectconfig:' + name, f'isa = XCBuildConfiguration; buildSettings = {{ {settings} }}; name = {name};'))
    target_settings = 'PRODUCT_BUNDLE_IDENTIFIER = com.rightclickreality.demo; PRODUCT_NAME = "$(TARGET_NAME)"; CODE_SIGN_STYLE = Automatic; GENERATE_INFOPLIST_FILE = NO; INFOPLIST_FILE = RightClickReality/Info.plist; TARGETED_DEVICE_FAMILY = 1; SUPPORTED_PLATFORMS = "iphoneos iphonesimulator"; SUPPORTS_MACCATALYST = NO; LD_RUNPATH_SEARCH_PATHS = ("$(inherited)","@executable_path/Frameworks",); '
    if name == 'Debug':
        target_settings += 'SWIFT_ACTIVE_COMPILATION_CONDITIONS = "DEBUG $(inherited)"; '
    target_configs.append(add('targetconfig:' + name, f'isa = XCBuildConfiguration; baseConfigurationReference = {config}; buildSettings = {{ {target_settings} }}; name = {name};'))

project_config_list = add('projectconfiglist', 'isa = XCConfigurationList; buildConfigurations = (' + ','.join(project_configs) + ',); defaultConfigurationIsVisible = 0; defaultConfigurationName = Release;')
target_config_list = add('targetconfiglist', 'isa = XCConfigurationList; buildConfigurations = (' + ','.join(target_configs) + ',); defaultConfigurationIsVisible = 0; defaultConfigurationName = Release;')
target = add('target', f'isa = PBXNativeTarget; buildConfigurationList = {target_config_list}; buildPhases = ({sources_phase},{frameworks_phase},{resources_phase},); buildRules = (); dependencies = (); name = RightClickReality; productName = RightClickReality; productReference = {product}; productType = "com.apple.product-type.application";')
project = add('project', f'isa = PBXProject; attributes = {{ BuildIndependentTargetsInParallel = YES; LastUpgradeCheck = 1600; TargetAttributes = {{ {target} = {{ CreatedOnToolsVersion = 16.0; }}; }}; }}; buildConfigurationList = {project_config_list}; compatibilityVersion = "Xcode 14.0"; developmentRegion = zh_CN; hasScannedForEncodings = 0; knownRegions = (en,Base,zh_CN,); mainGroup = {main_group}; productRefGroup = {products_group}; projectDirPath = ""; projectRoot = ""; targets = ({target},);')

text = '// !$*UTF8*$!\n{\n\tarchiveVersion = 1;\n\tclasses = {};\n\tobjectVersion = 56;\n\tobjects = {\n' + '\n'.join(records) + f'\n\t}};\n\trootObject = {project};\n}}\n'
(project_dir / 'project.pbxproj').write_text(text)

schemes = project_dir / 'xcshareddata' / 'xcschemes'
schemes.mkdir(parents=True, exist_ok=True)
reference = f'<BuildableReference BuildableIdentifier="primary" BlueprintIdentifier="{target}" BuildableName="RightClickReality.app" BlueprintName="RightClickReality" ReferencedContainer="container:RightClickReality.xcodeproj"/>'
(schemes / 'RightClickReality.xcscheme').write_text(f'''<?xml version="1.0" encoding="UTF-8"?>
<Scheme LastUpgradeVersion="1600" version="1.3">
 <BuildAction parallelizeBuildables="YES" buildImplicitDependencies="YES"><BuildActionEntries><BuildActionEntry buildForTesting="YES" buildForRunning="YES" buildForProfiling="YES" buildForArchiving="YES" buildForAnalyzing="YES">{reference}</BuildActionEntry></BuildActionEntries></BuildAction>
 <TestAction buildConfiguration="Debug" selectedDebuggerIdentifier="Xcode.DebuggerFoundation.Debugger.LLDB" selectedLauncherIdentifier="Xcode.IDEFoundation.Launcher.LLDB" shouldUseLaunchSchemeArgsEnv="YES"><Testables/></TestAction>
 <LaunchAction buildConfiguration="Debug" selectedDebuggerIdentifier="Xcode.DebuggerFoundation.Debugger.LLDB" selectedLauncherIdentifier="Xcode.IDEFoundation.Launcher.LLDB" launchStyle="0" useCustomWorkingDirectory="NO" ignoresPersistentStateOnLaunch="NO" debugDocumentVersioning="YES" debugServiceExtension="internal" allowLocationSimulation="YES"><BuildableProductRunnable runnableDebuggingMode="0">{reference}</BuildableProductRunnable></LaunchAction>
 <ProfileAction buildConfiguration="Release" shouldUseLaunchSchemeArgsEnv="YES" savedToolIdentifier="" useCustomWorkingDirectory="NO" debugDocumentVersioning="YES"><BuildableProductRunnable runnableDebuggingMode="0">{reference}</BuildableProductRunnable></ProfileAction>
 <AnalyzeAction buildConfiguration="Debug"/>
 <ArchiveAction buildConfiguration="Release" revealArchiveInOrganizer="YES"/>
</Scheme>
''')
print(f'Generated Xcode project with {len(sources)} Swift source files.')
