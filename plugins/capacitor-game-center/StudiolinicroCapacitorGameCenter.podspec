require 'json'
package = JSON.parse(File.read(File.join(__dir__, 'package.json')))

Pod::Spec.new do |s|
  s.name = 'StudiolinicroCapacitorGameCenter'
  s.version = package['version']
  s.summary = package['description']
  s.license = 'UNLICENSED'
  s.homepage = 'https://example.invalid/studiolinicro'
  s.author = package['author']
  s.source = { :path => '.' }
  s.source_files = 'ios/Sources/**/*.swift'
  s.ios.deployment_target = '15.0'
  s.frameworks = 'GameKit'
  s.dependency 'Capacitor'
  s.swift_version = '5.9'
end
