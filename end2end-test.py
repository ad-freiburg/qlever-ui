#!/usr/bin/python3
"""
Copyright 2023, University of Freiburg,
Chair of Algorithms and Data Structures
Author: Hannah Bast <bast@cs.uni-freiburg.de>
"""

from selenium import webdriver
from selenium.webdriver.firefox.options import Options
from selenium.webdriver.firefox.firefox_binary import FirefoxBinary
# from selenium.webdriver.chrome.options import Options
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

from selenium.webdriver.common.by import By

import argparse
import logging
import sys


# Global log with custom formatter, inspired by several posts on Stackoverflow.
class MyFormatter(logging.Formatter):
    def __init__(self):
        super().__init__(datefmt="%Y-%m-%d %H:%M:%S")

    def format(self, record):
        format_orig = self._style._fmt
        fmt_begin, fmt_end = "", ""
        if record.levelno == logging.ERROR:
            fmt_begin, fmt_end = "\x1b[31m", "\x1b[0m"
        elif record.levelno == logging.WARN:
            fmt_begin, fmt_end = "\x1b[35m", "\x1b[0m"
        fmt = "%(asctime)s.%(msecs)03d %(levelname)-5s %(message)s"
        self._style._fmt = fmt_begin + fmt + fmt_end
        result = logging.Formatter.format(self, record)
        self._style._fmt = format_orig
        return result


log = logging.getLogger("e2e test logger")
log.setLevel(logging.INFO)
handler = logging.StreamHandler()
handler.setFormatter(MyFormatter())
log.addHandler(handler)


class QleverUiTester:
    """
    Class or testing the Qlever UI.

    NOTE: The basic structure of this code is taken from
    https://github.com/ad-freiburg/hisinone-scraper
    """

    def __init__(self, headless, url, num_retries):
        """
        Basic settings and open the browser window.
        """

        self.headless = headless
        self.url = url
        self.num_retries = num_retries
        self.timeout_loading = 5
        options = Options()
        if self.headless:
            log.info("Running in \x1b[1mheadless\x1b[0m mode")
            options.add_argument("-headless")
        else:
            log.info("Not headless, rerun with --headless to activate")
        log.info("Initializing webdriver ...")
        # options.binary = FirefoxBinary("/usr/bin/firefox")
        self.driver = webdriver.Firefox(options=options)
        # self.driver = webdriver.Chrome(options=options)
        # self.driver.set_window_position(100, 0)
        # self.driver.set_window_size(1400, 600)

    def done(self):
        """
        Close the browser window if it's still there.
        """

        try:
            self.driver.close()
        except Exception:
            pass

    def test(self):
        """
        Some basic tests to check if the UI is working.
        """

        for i in range(self.num_retries):
            try:
                self.driver.get(self.url)
                WebDriverWait(self.driver, self.timeout_loading).until(
                      EC.presence_of_element_located((By.ID, "query")))
                log.info(f"Page {self.url} loaded successfully")
                break
            except Exception as e:
                if i < self.num_retries - 1:
                    log.info(f"Loading page failed"
                             f" (attempt {i + 1} of {self.num_retries}"
                             f", error: \"{str(e)}\")"
                             f", trying again ...")
                else:
                    log.error("Aborting after %d retries." % self.num_retries)
                    self.done()
                    sys.exit(1)


class MyArgumentParser(argparse.ArgumentParser):
    """
    Override the error message so that it prints the full help text if the
    script is called without arguments or with a wrong argument.
    """

    def error(self, message):
        print("ArgumentParser: %s\n" % message)
        self.print_help()
        sys.exit(1)


if __name__ == "__main__":

    # Setup parser and basic usage information.
    parser = MyArgumentParser(
            epilog="Example invocation: python3 hisinone-scraper",
            formatter_class=argparse.RawDescriptionHelpFormatter)

    # Command line arguments.
    parser.add_argument(
            "--not-headless", dest="not_headless", action="store_true",
            help="Run browser in headful mode (default: headless mode)")
    parser.add_argument(
            "--url", dest="url", type=str,
            default="https://qlever.cs.uni-freiburg.de",
            help="The URL of the QLever UI (may redirect)")
    parser.add_argument(
            "--num-retries", dest="num_retries", type=int, default=5,
            help="Number of retries for loading a page")
    parser.add_argument(
            "--log-level", dest="log_level", type=str,
            choices=["INFO", "DEBUG", "ERROR"], default="INFO",
            help="Log level (INFO, DEBUG, ERROR)")
    args = parser.parse_args(sys.argv[1:])

    # Set log level and show it.
    log.setLevel(eval("logging.%s" % args.log_level))
    print()
    log.info("Log level is \x1b[1m%s\x1b[0m" % args.log_level)

    # Test the QLever UI.
    qleverui_tester = QleverUiTester(
            not args.not_headless, args.url, args.num_retries)
    qleverui_tester.test()
    qleverui_tester.done()
