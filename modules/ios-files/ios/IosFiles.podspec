Pod::Spec.new do |s|
  s.name           = 'IosFiles'
  s.version        = '0.1.0'
  s.summary        = 'Evenlease iOS file helpers (backup exclusion, folder bookmarks)'
  s.description    = 'Evenlease iOS file helpers (backup exclusion, folder bookmarks)'
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
