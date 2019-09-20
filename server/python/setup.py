"""
setup file to facilitate the Wrattler python service
being used as a python package.
This may be useful when deploying Wrattler on the cloud,
where the python service might be started by a proxy, as
it means that the flask application can be launched from
any directory.
"""

from setuptools import setup

with open("requirements.txt", "r") as f:
    REQUIRED_PACKAGES = f.read().splitlines()


setup(
    name="wrattler-python-service",
    version="0.4",
    description="Python language service for the Wrattler notebook project",
    url="https://github.com/wrattler/wrattler",
    author="Nick Barlow, Tomas Petricek, May Yong",
    license="MIT",
    include_package_data=True,
    packages=["."],
    install_requires=REQUIRED_PACKAGES,
    entry_points={
        "console_scripts": [
            "wrattler-python-service=app:main"
        ]
    }
)
