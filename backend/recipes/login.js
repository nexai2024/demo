
class LoginPage {
    constructor(page) {
      this.page = page;
      this.usernameInput = page.locator('input[id="identifier-field"]');
      this.continueButton = page.locator('button[text="Continue"]');
      this.passwordInput = page.locator('input[id="password-field"]');
      this.submitButton = page.locator('button[text="Continue"]');
      //this.errorMessage = page.locator('.error-message');
    }
  
    async navigate() {
      await this.page.goto('/login');
    }
  
    async login(username, password) {
      await this.usernameInput.fill(username);
      await this.passwordInput.fill(password);
      await this.submitButton.click();
    }
  
    async getErrorMessage() {
      return await this.errorMessage.textContent();
    }
  }
  
  // Usage in test
  test('login with valid credentials', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.navigate();
    await loginPage.login('dtparker19@gmail.com', 'AngelBlueMissy3#');
    await expect(page).toHaveURL('/dashboard');
  });