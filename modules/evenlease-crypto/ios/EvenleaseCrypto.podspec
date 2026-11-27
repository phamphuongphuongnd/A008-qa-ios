Pod::Spec.new do |s|
  s.name           = 'EvenleaseCrypto'
  s.version        = '0.1.0'
  s.summary        = 'Evenlease native PBKDF2-HMAC-SHA256 (backup password)'
  s.description    = 'Evenlease native PBKDF2-HMAC-SHA256 (backup password)'
  s.author         = ''
  s.homepage       = 'https://github.com/MA-Global-VN/P_evenlease'
  s.license        = 'UNLICENSED'
  s.platforms      = { :ios => '16.4' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = '**/*.{h,m,swift}'
end
