'use strict';

import * as chai from 'chai';
import KarmaTestRunner from '../../../src/karma-runner/KarmaTestRunner';
import {TestResult, RunnerOptions, RunResult} from '../../../src/api/test_runner';
import * as chaiAsPromised from 'chai-as-promised';
chai.use(chaiAsPromised);
let expect = chai.expect;

describe('KarmaTestRunner', function() {

  var sut: KarmaTestRunner;
  this.timeout(10000);

  describe('when code coverage is enabled', () => {
    let testRunnerOptions: RunnerOptions;

    before(() => {
      testRunnerOptions = {
        sourceFiles: ['test/sampleProject/src/Add.js'],
        additionalFiles: ['test/sampleProject/test/AddSpec.js'],
        port: 9877,
        coverageEnabled: true,
        strykerOptions: {}
      };
    });

    describe('with simple add function to test', () => {

      before(() => {
        sut = new KarmaTestRunner(testRunnerOptions);
      });

      it('should report completed tests with code coverage', () => {
        return expect(sut.run()).to.eventually.satisfy((testResult: RunResult) => {
          expect(testResult.succeeded).to.be.eq(5);
          expect(testResult.failed).to.be.eq(0);
          expect(testResult.result).to.be.eq(TestResult.Complete);
          let coverageOfFirstFile = testResult.coverage[Object.keys(testResult.coverage)[0]];
          expect(coverageOfFirstFile.statementMap).to.be.ok;
          expect(coverageOfFirstFile.s).to.be.ok;
          return true;
        });
      });

      it('should be able to run twice in quick succession', () => {
        return expect(sut.run().then(() => sut.run())).to.eventually.have.property('succeeded', 5);
      });
    });
  });

  describe('when code coverage is disabled', () => {
    let testRunnerOptions: RunnerOptions;

    before(() => {
      testRunnerOptions = {
        sourceFiles: ['test/sampleProject/src/Add.js'],
        additionalFiles: ['test/sampleProject/test/AddSpec.js'],
        port: 9878,
        coverageEnabled: false,
        strykerOptions: {}
      };
    });

    describe('with simple add function to test', () => {

      before(() => {
        sut = new KarmaTestRunner(testRunnerOptions);
      });

      it('should report completed tests without coverage', () => {
        return expect(sut.run()).to.eventually.satisfy((testResult: RunResult) => {
          expect(testResult.succeeded).to.be.eq(5);
          expect(testResult.failed).to.be.eq(0);
          expect(testResult.result).to.be.eq(TestResult.Complete);
          expect(testResult.coverage).to.not.be.ok;
          return true;
        });
      });
    });
  });

});