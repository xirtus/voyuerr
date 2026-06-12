/// <reference types="cypress" />

describe('Adult Scene Discovery', () => {
  beforeEach(() => {
    cy.login();
  });

  it('shows the age gate on first visit', () => {
    cy.clearLocalStorage('voyeurr_age_verified');
    cy.visit('/');
    cy.get('[data-testid="age-gate"]').should('be.visible');
  });

  it('loads the discover page with filter sidebar', () => {
    cy.visit('/');
    cy.get('[data-testid="discover-slider"]').should('exist');
    // Filter sidebar toggle
    cy.contains('Filters').click();
    cy.get('.filter-sidebar').should('be.visible');
  });

  it('shows adult category filters', () => {
    cy.visit('/discover/scenes');
    cy.contains('Filters').click();
    cy.contains('Western').should('be.visible');
    cy.contains('JAV').should('be.visible');
    cy.contains('Hentai').should('be.visible');
    cy.contains('VR').should('be.visible');
  });

  it('loads a scene detail page', () => {
    // Visit a scene detail page (requires seeded test data)
    cy.visit('/scene/1');
    cy.get('[data-testid="media-title"]').should('exist');
    cy.contains('Performers').should('be.visible');
  });

  it('shows performer profile', () => {
    cy.visit('/performer/1');
    cy.get('h1').should('exist');
  });

  it('shows studio details', () => {
    cy.visit('/studio/1');
    cy.get('[data-testid="studio-title"]').should('exist');
  });

  it('scene card shows request button', () => {
    cy.visit('/');
    cy.get('[data-testid="scene-card"]').first().trigger('mouseenter');
    cy.contains('Request').should('be.visible');
  });

  it('privacy settings page is accessible', () => {
    cy.visit('/profile/privacy');
    cy.contains('Content Filters').should('be.visible');
    cy.contains('NSFW Image Blur').should('be.visible');
    cy.contains('Privacy Mode').should('be.visible');
    cy.contains('Notification Privacy').should('be.visible');
  });
});

describe('Adult Content Request Flow', () => {
  beforeEach(() => {
    cy.login();
  });

  it('opens scene request modal with quality selector', () => {
    cy.visit('/discover/scenes');
    cy.get('[data-testid="scene-card"]').first().trigger('mouseenter');
    cy.contains('Request').click();
    cy.contains('Request Scene').should('be.visible');
    cy.contains('1080p').should('be.visible');
    cy.contains('4K UHD').should('be.visible');
    cy.contains('VR').should('be.visible');
    cy.contains('60fps').should('be.visible');
  });
});
