"""Download the pinned official Matterport SDK Bundle; no credentials required."""
from pathlib import Path
from tempfile import TemporaryDirectory
from urllib.request import urlretrieve
from zipfile import ZipFile
bundle = Path(__file__).resolve().parents[1] / 'public' / 'matterport-bundle'
url = 'https://static.matterport.com/showcase-sdk/bundle/26.10.4_webgl-1728-g1cd7e0997a/showcase-bundle.zip'
if (bundle / 'showcase.html').exists():
    print('Matterport Bundle is already installed.')
else:
    with TemporaryDirectory() as tmp:
        archive = Path(tmp) / 'bundle.zip'
        urlretrieve(url, archive)
        bundle.mkdir(parents=True, exist_ok=True)
        with ZipFile(archive) as zip_file:
            for item in zip_file.infolist():
                target = (bundle / item.filename).resolve()
                if not target.is_relative_to(bundle.resolve()):
                    raise SystemExit('Unexpected archive path')
            zip_file.extractall(bundle)
    print('Matterport Bundle installed from the official distribution.')
