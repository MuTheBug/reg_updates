from playwright.sync_api import sync_playwright
import os

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context()
    page = context.new_page()

    # Login
    page.goto("http://localhost:3000/login")
    page.fill("input[type='password']", "admin123") # Correct selector
    page.click("button[type='submit']") # Or click the button

    # Wait for navigation or admin page
    page.wait_for_url("**/admin")

    # Click Edit on the first record
    # Wait for table to load
    page.wait_for_selector(".act-edit")
    page.click(".act-edit >> nth=0")

    # Wait for modal
    page.wait_for_selector("#detailModal.show")

    # Take screenshot of the modal
    os.makedirs("/home/jules/verification", exist_ok=True)
    page.screenshot(path="/home/jules/verification/edit_modal.png")

    browser.close()

with sync_playwright() as playwright:
    run(playwright)
