import os
import zipfile
import json
import xml.etree.ElementTree as ET
from xml.sax.saxutils import escape

with open('package.json', 'r', encoding='utf-8') as f:
    pkg = json.load(f)

vsix_name = f"{pkg['name']}-{pkg['version']}.vsix"

name_esc = escape(str(pkg.get('name', '')))
version_esc = escape(str(pkg.get('version', '1.0.0')))
publisher_esc = escape(str(pkg.get('publisher', '')))
display_name_esc = escape(str(pkg.get('displayName', '')))
desc_esc = escape(str(pkg.get('description', '')))

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
    <Identity Language="en-US" Id="{name_esc}" Version="{version_esc}" Publisher="{publisher_esc}"/>
    <DisplayName>{display_name_esc}</DisplayName>
    <Description xml:space="preserve">{desc_esc}</Description>
    <Tags>bad apple,ascii,touhou,retro,crt,terminal</Tags>
    <Categories>Other,Visualization</Categories>
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

# Validate XML strictly before writing
ET.fromstring(content_types_xml)
ET.fromstring(vsix_manifest_xml)
print("XML validation passed with zero errors!")

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

print(f'VSIX successfully generated and validated: {vsix_name}')
