import React, { useContext, useEffect } from 'react';
import PropTypes from 'prop-types';

import { Formik } from 'formik';
import { useDispatch, useSelector } from 'react-redux';
import { generatePath, useHistory, useParams } from 'react-router';
import * as Yup from 'yup';

import { injectIntl, intlShape } from '@edx/frontend-platform/i18n';
import { AppContext } from '@edx/frontend-platform/react';
import { Card, Form, StatefulButton } from '@edx/paragon';
import { Help, Post } from '@edx/paragon/icons';

import { TinyMCEEditor } from '../../../components';
import FormikErrorFeedback from '../../../components/FormikErrorFeedback';
import { selectCourseCohorts } from '../../cohorts/data/selectors';
import { fetchCourseCohorts } from '../../cohorts/data/thunks';
import { selectAnonymousPostingConfig } from '../../data/selectors';
import { selectCourseTopics } from '../../topics/data/selectors';
import { fetchCourseTopics } from '../../topics/data/thunks';
import { formikCompatibleHandler, isFormikFieldInvalid, useCommentsPagePath } from '../../utils';
import { hidePostEditor } from '../data';
import { selectThread } from '../data/selectors';
import { createNewThread, fetchThread, updateExistingThread } from '../data/thunks';
import messages from './messages';

function DiscussionPostType({
  value,
  type,
  selected,
  description,
  icon,
}) {
  // Need to use regular label since Form.Label doesn't support overriding htmlFor
  return (
    <label htmlFor={`post-type-${value}`} className="d-flex p-0 my-0 mr-3">
      <Form.Radio value={value} id={`post-type-${value}`} className="sr-only">{type}</Form.Radio>
      <Card className={selected ? 'border border-primary border-2' : ''}>
        <Card.Body>
          <Card.Text className="d-flex flex-column align-items-center">
            <span className="text-gray-900">{icon}</span>
            <span>{type}</span>
            <span className="x-small text-gray-500">{description}</span>
          </Card.Text>
        </Card.Body>
      </Card>
    </label>
  );
}

DiscussionPostType.propTypes = {
  value: PropTypes.string.isRequired,
  type: PropTypes.string.isRequired,
  selected: PropTypes.bool.isRequired,
  description: PropTypes.string.isRequired,
  icon: PropTypes.element.isRequired,
};

function PostEditor({
  intl,
  editExisting,
}) {
  const { authenticatedUser } = useContext(AppContext);
  const dispatch = useDispatch();
  const history = useHistory();
  const commentsPagePath = useCommentsPagePath();
  const {
    courseId,
    topicId,
    postId,
  } = useParams();
  const {
    coursewareTopics,
    nonCoursewareTopics,
  } = useSelector(selectCourseTopics());
  const {
    allowAnonymous,
    allowAnonymousToPeers,
  } = useSelector(selectAnonymousPostingConfig);
  const cohorts = useSelector(selectCourseCohorts);
  const post = useSelector(selectThread(postId));
  const initialValues = {
    postType: post?.type || 'discussion',
    topic: post?.topicId || topicId || nonCoursewareTopics?.[0]?.id,
    title: post?.title || '',
    comment: post?.rawBody || '',
    follow: post?.following ?? true,
    anonymous: allowAnonymous ? false : undefined,
    anonymousToPeers: allowAnonymousToPeers ? false : undefined,
  };
  const canSelectCohort = authenticatedUser.administrator && !editExisting;
  const hideEditor = () => {
    if (editExisting) {
      history.push(generatePath(commentsPagePath, {
        courseId,
        topicId,
        postId,
      }));
    }
    dispatch(hidePostEditor());
  };

  const submitForm = async (values) => {
    if (editExisting) {
      dispatch(updateExistingThread(postId, {
        topicId: values.topic,
        type: values.postType,
        title: values.title,
        content: values.comment,
      }));
    } else {
      const cohort = canSelectCohort
        // null stands for no cohort restriction ("All learners" option)
        ? (values.cohort ?? null)
        // if not allowed to set cohort, always undefined, so no value is sent to backend
        : undefined;
      dispatch(createNewThread({
        courseId,
        topicId: values.topic,
        type: values.postType,
        title: values.title,
        content: values.comment,
        following: values.following,
        anonymous: values.anonymous,
        anonymousToPeers: values.anonymousToPeers,
        cohort,
      }));
    }
    hideEditor();
  };

  useEffect(() => {
    dispatch(fetchCourseTopics(courseId));
    if (canSelectCohort) {
      dispatch(fetchCourseCohorts(courseId));
    }
    if (editExisting) {
      dispatch(fetchThread(postId));
    }
  }, [courseId, editExisting]);

  return (
    <Formik
      enableReinitialize
      initialValues={initialValues}
      validationSchema={Yup.object()
        .shape({
          postType: Yup.mixed()
            .oneOf(['discussion', 'question']),
          topic: Yup.string()
            .required(),
          title: Yup.string()
            .required(intl.formatMessage(messages.titleError)),
          comment: Yup.string()
            .required(intl.formatMessage(messages.commentError)),
          follow: Yup.bool()
            .default(true),
          anonymous: Yup.bool().default(false)
            .nullable(),
          anonymousToPeers: Yup.bool().default(false)
            .nullable(),
          cohort: Yup.string(),
        })}
      initialErrors={{}}
      onSubmit={submitForm}
    >{
      ({
        values,
        errors,
        touched,
        handleSubmit,
        handleBlur,
        handleChange,
      }) => (
        <Form className="m-4 card p-4" onSubmit={handleSubmit}>
          <h3>
            {editExisting
              ? intl.formatMessage(messages.editPostHeading)
              : intl.formatMessage(messages.addPostHeading)}
          </h3>
          <Form.RadioSet
            name="postType"
            className="d-flex flex-row my-3"
            value={values.postType}
            onChange={handleChange}
            onBlur={handleBlur}
            aria-label={intl.formatMessage(messages.postTitle)}
          >
            <DiscussionPostType
              value="discussion"
              selected={values.postType === 'discussion'}
              type={intl.formatMessage(messages.discussionType)}
              icon={<Post />}
              description={intl.formatMessage(messages.discussionDescription)}
            />
            <DiscussionPostType
              value="question"
              selected={values.postType === 'question'}
              type={intl.formatMessage(messages.questionType)}
              icon={<Help />}
              description={intl.formatMessage(messages.questionDescription)}
            />
          </Form.RadioSet>
          <div className="py-3">
            <Form.Group className="w-50 d-inline-block pr-2">
              <Form.Control
                name="topic"
                as="select"
                value={values.topic}
                onChange={handleChange}
                onBlur={handleBlur}
                aria-describedby="topicAreaInput"
                floatingLabel={intl.formatMessage(messages.topicArea)}
              >
                {nonCoursewareTopics.map(topic => (
                  <option key={topic.id} value={topic.id}>{topic.name}</option>
                ))}
                {coursewareTopics.map(topic => (
                  <optgroup label={topic.name} key={topic.name}>
                    {topic.children.map(subtopic => (
                      <option
                        key={subtopic.id}
                        value={subtopic.id}
                      >
                        {subtopic.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </Form.Control>
            </Form.Group>
            {canSelectCohort
              && (
              <Form.Group className="w-50 d-inline-block pl-2">
                <Form.Control
                  name="cohort"
                  as="select"
                  value={values.cohort}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  aria-describedby="cohortVisiblityInput"
                  floatingLabel={intl.formatMessage(messages.cohortVisibility)}
                >
                  <option value="">{intl.formatMessage(messages.cohortVisibilityAllLearners)}</option>
                  {cohorts.map(cohort => (
                    <option key={cohort.id} value={cohort.id}>{cohort.name}</option>
                  ))}
                </Form.Control>
              </Form.Group>
              )}
          </div>
          <div className="border-bottom my-1" />
          <Form.Group
            className="py-2 mt-4"
            isInvalid={isFormikFieldInvalid('title', {
              errors,
              touched,
            })}
          >
            <Form.Control
              name="title"
              type="text"
              onChange={handleChange}
              onBlur={handleBlur}
              aria-describedby="titleInput"
              floatingLabel={intl.formatMessage(messages.postTitle)}
              value={values.title}
            />
            <FormikErrorFeedback name="title" />
          </Form.Group>
          <div className="py-2">
            <TinyMCEEditor
              value={values.comment}
              onEditorChange={formikCompatibleHandler(handleChange, 'comment')}
              onBlur={formikCompatibleHandler(handleBlur, 'comment')}
            />
            <FormikErrorFeedback name="comment" />
          </div>

          {!editExisting
            && (
              <div className="d-flex flex-row mt-3">
                <Form.Group>
                  <Form.Checkbox
                    name="follow"
                    checked={values.follow}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    className="mr-4"
                  >
                    {intl.formatMessage(messages.followPost)}
                  </Form.Checkbox>
                </Form.Group>
                {allowAnonymous && (
                  <Form.Group>
                    <Form.Checkbox
                      name="anonymous"
                      checked={values.anonymous}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      className="mr-4"
                    >
                      {intl.formatMessage(messages.anonymousPost)}
                    </Form.Checkbox>
                  </Form.Group>
                )}
                {allowAnonymousToPeers
                  && (
                    <Form.Group>
                      <Form.Checkbox
                        name="anonymousToPeers"
                        checked={values.anonymousToPeers}
                        onChange={handleChange}
                        onBlur={handleBlur}
                      >
                        {intl.formatMessage(messages.anonymousToPeersPost)}
                      </Form.Checkbox>
                    </Form.Group>
                  )}
              </div>
            )}

          <div className="d-flex justify-content-end">
            <StatefulButton
              labels={{
                default: intl.formatMessage(messages.cancel),
              }}
              variant="outline-primary"
              onClick={hideEditor}
            />
            <StatefulButton
              labels={{
                default: intl.formatMessage(messages.submit),
              }}
              className="ml-2"
              variant="primary"
              onClick={handleSubmit}
            />
          </div>
        </Form>
      )
    }
    </Formik>
  );
}

PostEditor.propTypes = {
  intl: intlShape.isRequired,
  editExisting: PropTypes.bool,
};

PostEditor.defaultProps = {
  editExisting: false,
};

export default injectIntl(PostEditor);
