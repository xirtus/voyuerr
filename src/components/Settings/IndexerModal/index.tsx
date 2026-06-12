import Modal from '@app/components/Common/Modal';
import SensitiveInput from '@app/components/Common/SensitiveInput';
import useToasts from '@app/hooks/useToasts';
import globalMessages from '@app/i18n/globalMessages';
import defineMessages from '@app/utils/defineMessages';
import { isValidURL } from '@app/utils/urlValidationHelper';
import { Transition } from '@headlessui/react';
import type { IndexerSettings, IndexerServiceType } from '@server/lib/settings';
import axios from 'axios';
import { Field, Formik } from 'formik';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useIntl } from 'react-intl';
import type { OnChangeValue } from 'react-select';
import Select from 'react-select';
import * as Yup from 'yup';

type OptionType = {
  value: number;
  label: string;
};

interface IndexerTestResponse {
  version: string;
  indexers: { id: string; name: string; configured: boolean }[];
}

const messages = defineMessages('components.Settings.IndexerModal', {
  createindexer: 'Add New Indexer Server',
  editindexer: 'Edit Indexer Server',
  validationNameRequired: 'You must provide a server name',
  validationHostnameRequired: 'You must provide a valid hostname or IP address',
  validationPortRequired: 'You must provide a valid port number',
  validationApiKeyRequired: 'You must provide an API key',
  toastIndexerTestSuccess: 'Indexer connection established successfully!',
  toastIndexerTestFailure: 'Failed to connect to the indexer.',
  add: 'Add Server',
  servername: 'Server Name',
  hostname: 'Hostname or IP Address',
  port: 'Port',
  ssl: 'Use SSL',
  apiKey: 'API Key',
  baseUrl: 'URL Base',
  externalUrl: 'External URL',
  servicetype: 'Service Type',
  priority: 'Priority',
  priorityHelp: 'Lower priority servers are checked first (1 = highest, 10 = lowest).',
  categories: 'Adult Categories',
  enabled: 'Enabled',
  enabledHelp: 'Enable this indexer server for searches.',
  selectCategories: 'Select categories…',
  notagoptions: 'No categories.',
  jackett: 'Jackett',
  prowlarr: 'Prowlarr',
  testFirst: 'Test connection to discover indexers',
  loadingIndexers: 'Loading indexers…',
  indexersFound: '{count} indexer(s) found ({configured} configured)',
  apiKeyHelp: 'Find it in Jackett: bottom-right corner of the web UI. In Prowlarr: Settings > General > API Key.',
  baseUrlHelp:
    'If you set a URL Base (in Jackett, the "Base path override"), enter it here (e.g. /jackett). Leave blank otherwise.',
  externalUrlHelp:
    'For clickable links when the hostname is not reachable from outside your network.',
  validationApplicationUrl: 'You must provide a valid URL',
  validationApplicationUrlTrailingSlash: 'URL must not end in a trailing slash',
  validationBaseUrlLeadingSlash: 'URL base must have a leading slash',
  validationBaseUrlTrailingSlash: 'URL base must not end in a trailing slash',
});

interface IndexerModalProps {
  indexer: IndexerSettings | null;
  onClose: () => void;
  onSave: () => void;
}

// Newznab adult category presets
const CATEGORY_PRESETS: { value: number; label: string }[] = [
  { value: 5000, label: 'XXX General (5000)' },
  { value: 6000, label: 'XXX x264 (6000)' },
];

const IndexerModal = ({ onClose, indexer, onSave }: IndexerModalProps) => {
  const intl = useIntl();
  const initialLoad = useRef(false);
  const { addToast } = useToasts();
  const [isValidated, setIsValidated] = useState(indexer ? true : false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResponse, setTestResponse] = useState<IndexerTestResponse>({
    version: '',
    indexers: [],
  });

  const IndexerSettingsSchema = Yup.object().shape({
    name: Yup.string().required(
      intl.formatMessage(messages.validationNameRequired)
    ),
    hostname: Yup.string().required(
      intl.formatMessage(messages.validationHostnameRequired)
    ),
    port: Yup.number()
      .nullable()
      .required(intl.formatMessage(messages.validationPortRequired)),
    apiKey: Yup.string().required(
      intl.formatMessage(messages.validationApiKeyRequired)
    ),
    externalUrl: Yup.string()
      .test(
        'valid-url',
        intl.formatMessage(messages.validationApplicationUrl),
        isValidURL
      )
      .test(
        'no-trailing-slash',
        intl.formatMessage(messages.validationApplicationUrlTrailingSlash),
        (value) => !value || !value.endsWith('/')
      ),
    baseUrl: Yup.string()
      .test(
        'leading-slash',
        intl.formatMessage(messages.validationBaseUrlLeadingSlash),
        (value) => !value || value.startsWith('/')
      )
      .test(
        'no-trailing-slash',
        intl.formatMessage(messages.validationBaseUrlTrailingSlash),
        (value) => !value || !value.endsWith('/')
      ),
  });

  const testConnection = useCallback(
    async ({
      type,
      hostname,
      port,
      apiKey,
      baseUrl,
      useSsl = false,
    }: {
      type: IndexerServiceType;
      hostname: string;
      port: number;
      apiKey: string;
      baseUrl?: string;
      useSsl?: boolean;
    }) => {
      setIsTesting(true);
      try {
        const response = await axios.post<IndexerTestResponse>(
          '/api/v1/settings/indexer/test',
          {
            type,
            hostname,
            apiKey,
            port: Number(port),
            baseUrl,
            useSsl,
          }
        );

        setIsValidated(true);
        setTestResponse(response.data);
        if (initialLoad.current) {
          addToast(intl.formatMessage(messages.toastIndexerTestSuccess), {
            appearance: 'success',
            autoDismiss: true,
          });
        }
      } catch {
        setIsValidated(false);
        if (initialLoad.current) {
          addToast(intl.formatMessage(messages.toastIndexerTestFailure), {
            appearance: 'error',
            autoDismiss: true,
          });
        }
      } finally {
        setIsTesting(false);
        initialLoad.current = true;
      }
    },
    [addToast, intl]
  );

  useEffect(() => {
    if (indexer) {
      testConnection({
        type: indexer.type,
        apiKey: indexer.apiKey,
        hostname: indexer.hostname,
        port: indexer.port,
        baseUrl: indexer.baseUrl,
        useSsl: indexer.useSsl,
      });
    }
  }, [indexer, testConnection]);

  return (
    <Transition
      as="div"
      appear
      show
      enter="transition-opacity ease-in-out duration-300"
      enterFrom="opacity-0"
      enterTo="opacity-100"
      leave="transition-opacity ease-in-out duration-300"
      leaveFrom="opacity-100"
      leaveTo="opacity-0"
    >
      <Formik
        initialValues={{
          name: indexer?.name,
          type: indexer?.type ?? ('jackett' as IndexerServiceType),
          hostname: indexer?.hostname,
          port: indexer?.port ?? 9117,
          ssl: indexer?.useSsl ?? false,
          apiKey: indexer?.apiKey,
          baseUrl: indexer?.baseUrl,
          externalUrl: indexer?.externalUrl,
          priority: indexer?.priority ?? 1,
          activeCategories: indexer?.activeCategories ?? [5000],
          enabled: indexer?.enabled ?? true,
        }}
        validationSchema={IndexerSettingsSchema}
        onSubmit={async (values) => {
          try {
            const submission = {
              name: values.name,
              type: values.type,
              hostname: values.hostname,
              port: Number(values.port),
              apiKey: values.apiKey,
              useSsl: values.ssl,
              baseUrl: values.baseUrl,
              externalUrl: values.externalUrl,
              priority: values.priority,
              activeCategories: values.activeCategories,
              enabled: values.enabled,
              syncEnabled: values.enabled,
              indexers: testResponse.indexers,
            };
            if (!indexer) {
              await axios.post('/api/v1/settings/indexer', submission);
            } else {
              await axios.put(
                `/api/v1/settings/indexer/${indexer.id}`,
                submission
              );
            }

            onSave();
          } catch {
            // set error here
          }
        }}
      >
        {({
          errors,
          touched,
          values,
          handleSubmit,
          setFieldValue,
          isSubmitting,
          isValid,
        }) => {
          const configuredCount = testResponse.indexers.filter(
            (i) => i.configured
          ).length;
          const totalCount = testResponse.indexers.length;

          return (
            <Modal
              onCancel={onClose}
              okButtonType="primary"
              okText={
                isSubmitting
                  ? intl.formatMessage(globalMessages.saving)
                  : indexer
                    ? intl.formatMessage(globalMessages.save)
                    : intl.formatMessage(messages.add)
              }
              secondaryButtonType="warning"
              secondaryText={
                isTesting
                  ? intl.formatMessage(globalMessages.testing)
                  : intl.formatMessage(globalMessages.test)
              }
              onSecondary={() => {
                if (values.apiKey && values.hostname && values.port) {
                  testConnection({
                    type: values.type,
                    apiKey: values.apiKey,
                    baseUrl: values.baseUrl,
                    hostname: values.hostname,
                    port: values.port,
                    useSsl: values.ssl,
                  });
                }
              }}
              secondaryDisabled={
                !values.apiKey ||
                !values.hostname ||
                !values.port ||
                isTesting ||
                isSubmitting
              }
              okDisabled={!isValidated || isSubmitting || isTesting || !isValid}
              onOk={() => handleSubmit()}
              title={
                !indexer
                  ? intl.formatMessage(messages.createindexer)
                  : intl.formatMessage(messages.editindexer)
              }
            >
              <div className="mb-6">
                <div className="form-row">
                  <label htmlFor="name" className="text-label">
                    {intl.formatMessage(messages.servername)}
                    <span className="label-required">*</span>
                  </label>
                  <div className="form-input-area">
                    <div className="form-input-field">
                      <Field
                        id="name"
                        name="name"
                        type="text"
                        autoComplete="off"
                        data-form-type="other"
                        data-1pignore="true"
                        data-lpignore="true"
                        data-bwignore="true"
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                          setIsValidated(false);
                          setFieldValue('name', e.target.value);
                        }}
                      />
                    </div>
                    {errors.name &&
                      touched.name &&
                      typeof errors.name === 'string' && (
                        <div className="error">{errors.name}</div>
                      )}
                  </div>
                </div>
                <div className="form-row">
                  <label htmlFor="type" className="text-label">
                    {intl.formatMessage(messages.servicetype)}
                  </label>
                  <div className="form-input-area">
                    <div className="form-input-field">
                      <Field
                        as="select"
                        id="type"
                        name="type"
                        onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                          setIsValidated(false);
                          setFieldValue('type', e.target.value);
                          // Update default port
                          setFieldValue(
                            'port',
                            e.target.value === 'jackett' ? 9117 : 9696
                          );
                        }}
                      >
                        <option value="jackett">
                          {intl.formatMessage(messages.jackett)} (:9117)
                        </option>
                        <option value="prowlarr">
                          {intl.formatMessage(messages.prowlarr)} (:9696)
                        </option>
                      </Field>
                    </div>
                  </div>
                </div>
                <div className="form-row">
                  <label htmlFor="hostname" className="text-label">
                    {intl.formatMessage(messages.hostname)}
                    <span className="label-required">*</span>
                  </label>
                  <div className="form-input-area">
                    <div className="form-input-field">
                      <span className="protocol">
                        {values.ssl ? 'https://' : 'http://'}
                      </span>
                      <Field
                        id="hostname"
                        name="hostname"
                        type="text"
                        inputMode="url"
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                          setIsValidated(false);
                          setFieldValue('hostname', e.target.value);
                        }}
                        className="rounded-r-only"
                      />
                    </div>
                    {errors.hostname &&
                      touched.hostname &&
                      typeof errors.hostname === 'string' && (
                        <div className="error">{errors.hostname}</div>
                      )}
                  </div>
                </div>
                <div className="form-row">
                  <label htmlFor="port" className="text-label">
                    {intl.formatMessage(messages.port)}
                    <span className="label-required">*</span>
                  </label>
                  <div className="form-input-area">
                    <Field
                      id="port"
                      name="port"
                      type="text"
                      inputMode="numeric"
                      className="short"
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                        setIsValidated(false);
                        setFieldValue('port', e.target.value);
                      }}
                    />
                    {errors.port &&
                      touched.port &&
                      typeof errors.port === 'string' && (
                        <div className="error">{errors.port}</div>
                      )}
                  </div>
                </div>
                <div className="form-row">
                  <label htmlFor="ssl" className="checkbox-label">
                    {intl.formatMessage(messages.ssl)}
                  </label>
                  <div className="form-input-area">
                    <Field
                      type="checkbox"
                      id="ssl"
                      name="ssl"
                      onChange={() => {
                        setIsValidated(false);
                        setFieldValue('ssl', !values.ssl);
                      }}
                    />
                  </div>
                </div>
                <div className="form-row">
                  <label htmlFor="apiKey" className="text-label">
                    {intl.formatMessage(messages.apiKey)}
                    <span className="label-required">*</span>
                    <span className="label-tip">
                      {intl.formatMessage(messages.apiKeyHelp)}
                    </span>
                  </label>
                  <div className="form-input-area">
                    <div className="form-input-field">
                      <SensitiveInput
                        as="field"
                        id="apiKey"
                        name="apiKey"
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                          setIsValidated(false);
                          setFieldValue('apiKey', e.target.value);
                        }}
                      />
                    </div>
                    {errors.apiKey &&
                      touched.apiKey &&
                      typeof errors.apiKey === 'string' && (
                        <div className="error">{errors.apiKey}</div>
                      )}
                  </div>
                </div>
                <div className="form-row">
                  <label htmlFor="baseUrl" className="text-label">
                    {intl.formatMessage(messages.baseUrl)}
                    <span className="label-tip">
                      {intl.formatMessage(messages.baseUrlHelp)}
                    </span>
                  </label>
                  <div className="form-input-area">
                    <div className="form-input-field">
                      <Field
                        id="baseUrl"
                        name="baseUrl"
                        type="text"
                        inputMode="url"
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                          setIsValidated(false);
                          setFieldValue('baseUrl', e.target.value);
                        }}
                      />
                    </div>
                    {errors.baseUrl &&
                      touched.baseUrl &&
                      typeof errors.baseUrl === 'string' && (
                        <div className="error">{errors.baseUrl}</div>
                      )}
                  </div>
                </div>
                {isValidated && totalCount > 0 && (
                  <div className="form-row">
                    <label className="text-label">
                      {intl.formatMessage(messages.loadingIndexers)}
                    </label>
                    <div className="form-input-area">
                      <p className="mt-1 text-sm text-gray-300">
                        {intl.formatMessage(messages.indexersFound, {
                          count: totalCount,
                          configured: configuredCount,
                        })}
                      </p>
                      <ul className="mt-1 max-h-32 overflow-y-auto text-xs text-gray-400">
                        {testResponse.indexers.map((idx) => (
                          <li key={idx.id} className="flex items-center gap-1 py-0.5">
                            <span
                              className={`inline-block h-1.5 w-1.5 rounded-full ${
                                idx.configured ? 'bg-green-500' : 'bg-gray-500'
                              }`}
                            />
                            {idx.name}
                            {!idx.configured && (
                              <span className="text-gray-600">(unconfigured)</span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
                <div className="form-row">
                  <label htmlFor="activeCategories" className="text-label">
                    {intl.formatMessage(messages.categories)}
                  </label>
                  <div className="form-input-area">
                    <Select<OptionType, true>
                      options={CATEGORY_PRESETS}
                      isMulti
                      placeholder={
                        !isValidated
                          ? intl.formatMessage(messages.testFirst)
                          : intl.formatMessage(messages.selectCategories)
                      }
                      className="react-select-container"
                      classNamePrefix="react-select"
                      value={values.activeCategories
                        .map((catId) => {
                          const found = CATEGORY_PRESETS.find(
                            (c) => c.value === catId
                          );
                          return found ?? undefined;
                        })
                        .filter((o) => o !== undefined) as OptionType[]}
                      onChange={(value: OnChangeValue<OptionType, true>) => {
                        setFieldValue(
                          'activeCategories',
                          value.map((option) => option.value)
                        );
                      }}
                      noOptionsMessage={() =>
                        intl.formatMessage(messages.notagoptions)
                      }
                    />
                  </div>
                </div>
                <div className="form-row">
                  <label htmlFor="priority" className="text-label">
                    {intl.formatMessage(messages.priority)}
                    <span className="label-tip">
                      {intl.formatMessage(messages.priorityHelp)}
                    </span>
                  </label>
                  <div className="form-input-area">
                    <Field
                      as="select"
                      id="priority"
                      name="priority"
                    >
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </Field>
                  </div>
                </div>
                <div className="form-row">
                  <label htmlFor="externalUrl" className="text-label">
                    {intl.formatMessage(messages.externalUrl)}
                    <span className="label-tip">
                      {intl.formatMessage(messages.externalUrlHelp)}
                    </span>
                  </label>
                  <div className="form-input-area">
                    <div className="form-input-field">
                      <Field
                        id="externalUrl"
                        name="externalUrl"
                        type="text"
                        inputMode="url"
                      />
                    </div>
                    {errors.externalUrl &&
                      touched.externalUrl &&
                      typeof errors.externalUrl === 'string' && (
                        <div className="error">{errors.externalUrl}</div>
                      )}
                  </div>
                </div>
                <div className="form-row">
                  <label htmlFor="enabled" className="checkbox-label">
                    {intl.formatMessage(messages.enabled)}
                    <span className="label-tip">
                      {intl.formatMessage(messages.enabledHelp)}
                    </span>
                  </label>
                  <div className="form-input-area">
                    <Field
                      type="checkbox"
                      id="enabled"
                      name="enabled"
                    />
                  </div>
                </div>
              </div>
            </Modal>
          );
        }}
      </Formik>
    </Transition>
  );
};

export default IndexerModal;
