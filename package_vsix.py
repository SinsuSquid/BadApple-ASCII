import os
import zipfile
import json

with open('package.json', 'r', encoding='utf-8') as f:
    pkg = json.load(f)

vsix_name = f"{pkg['name']}-{pkg['version']}.vsix"

content_types_xml = '''<?xml version="1.0" encoding="utf-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="json" ContentType="application/json" />
  <Default Extension="js" ContentType="application/javascript" />
  <Default Extension="css" ContentType="text/css" />
  <Default Extension="mp4" ContentType="video/mp4" />
  <Default Extension="png" ContentType="image/png" />
  <Default Extension="svg" ContentType="image/svg+xml" />
  <Default Extension="md" ContentType="text/markdown" />
  <Default Extension="vsixmanifest" ContentType="text/xml" />
</Types>'''

vsix_manifest_xml = f'''<?xml version="1.0" encoding="utf-8"?>
<PackageManifest Version="2.0.0" xmlns="http://schemas.microsoft.com/developer/vsx-schema/2011" xmlns:d="http://schemas.microsoft.com/developer/vsx-schema-design/2011">
  <Metadata>
    <Identity Language="en-US" Id="{pkg['name']}" Version="{pkg['version']}" Publisher="{pkg['publisher']}"/>
    <DisplayName>{pkg['displayName']}</DisplayName>
    <Description xml:space="preserve">{pkg['description']}</Description>
    <Tags>bad apple,ascii,touhou,retro,crt,terminal</Tags>
    <Categories>Other,Themes,Visualization</Categories>
    <Icon>extension/media/icon.png</Icon>
  </Metadata>
  <Installation>
    <InstallationTarget Id="Microsoft.VisualStudio.Code"/>
  </Installation>
  <Dependencies/>
  <Assets>
    <Asset Type="Microsoft.VisualStudio.Code.Manifest" Path="extension/package.json" Addressable="true"/>
    <Asset Type="Microsoft.VisualStudio.Services.Content.Details" Path="extension/README.md" Addressable="true"/>
    <Asset Type="Microsoft.VisualStudio.Services.Icons.Default" Path="extension/media/icon.png" Addressable="true"/>
  </Assets>
</PackageManifest>'''

with zipfile.ZipFile(vsix_name, 'w', zipfile.ZIP_DEFLATED) as z:
    z.writestr('[Content_Types].xml', content_types_xml)
    z.writestr('extension.vsixmanifest', vsix_manifest_xml)
    
    files_to_pack = [
        'package.json',
        'extension.js',
        'README.md',
        'media/bad_apple.mp4',
        'media/icon.png',
        'media/apple-icon.svg',
        'media/player.js',
        'media/style.css'
    ]
    
    for f in files_to_pack:
        if os.path.exists(f):
            z.write(f, f'extension/{f}')
            print(f'Packed: extension/{f}')

print(f'VSIX created: {vsix_name}')
