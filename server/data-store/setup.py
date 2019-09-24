"""
setup file to facilitate the Wrattler datastore
being used as a python package.
This may be useful when deploying Wrattler on the cloud,
where the datastore might be started by a proxy, as
it means that the flask application can be launched from
any directory.
"""

from setuptools import setup

with open("requirements.txt", "r") as f:
    REQUIRED_PACKAGES = f.read().splitlines()


setup(
    name="wrattler-data-store",
    version="0.5",
    description="Flask app providing datastore for the Wrattler notebook project",
    url="https://github.com/wrattler/wrattler",
    author="Nick Barlow, Tomas Petricek, May Yong",
    license="MIT",
    include_package_data=True,
    packages=["wrattler_data_store"],
    install_requires=REQUIRED_PACKAGES,
    entry_points={
        "console_scripts": [
            "wrattler-data-store=wrattler_data_store.data_store:run_app"
        ]
    }
)
